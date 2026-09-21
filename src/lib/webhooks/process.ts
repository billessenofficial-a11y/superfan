import { eq } from "drizzle-orm";
import { db } from "@/db";
import { integrations, webhookEvents } from "@/db/schema";
import { ingestEvent } from "@/lib/events/ingest";
import { getAdapter } from "@/lib/integrations/registry";
import { getIntegration, touchIntegrationEvent } from "@/lib/integrations/store";
import type { IntegrationProvider } from "@/lib/integrations/types";

export type WebhookReceipt = {
  webhookId: string | null;
  status: "processed" | "duplicate" | "ignored" | "failed";
  produced: number;
  error?: string;
};

/**
 * Store → normalize → ingest. Shared by every webhook route.
 *
 *  1. The raw payload is stored first (status=received) so nothing is lost.
 *  2. A provider event id (when available) dedupes redelivered webhooks.
 *  3. The adapter normalizes the payload into FanEvents.
 *  4. Each event is ingested idempotently.
 */
export async function processWebhook(input: {
  provider: IntegrationProvider;
  artistId: string | null;
  externalEventId: string | null;
  topic: string | null;
  payload: unknown;
  headers: Record<string, string>;
}): Promise<WebhookReceipt> {
  const [stored] = await db
    .insert(webhookEvents)
    .values({
      provider: input.provider,
      artistId: input.artistId,
      externalEventId: input.externalEventId,
      topic: input.topic,
      payload: input.payload,
      headers: pickHeaders(input.headers),
      status: "received",
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (!stored) return { webhookId: null, status: "duplicate", produced: 0 };

  if (!input.artistId) {
    await db.update(webhookEvents).set({ status: "processed", processedAt: new Date(), error: "No matching integration" }).where(eq(webhookEvents.id, stored.id));
    return { webhookId: stored.id, status: "ignored", produced: 0 };
  }

  await db.update(webhookEvents).set({ status: "processing", attempts: 1 }).where(eq(webhookEvents.id, stored.id));
  try {
    const adapter = getAdapter(input.provider);
    const integration = await getIntegration(input.artistId, input.provider);
    const events = (await adapter?.normalizeWebhook?.(input.payload, { integration: integration ?? null, artistId: input.artistId, headers: input.headers })) ?? [];
    let produced = 0;
    for (const ev of events) {
      const res = await ingestEvent(ev);
      if (res.status === "created") produced++;
    }
    if (events.length > 0) await touchIntegrationEvent(input.artistId, input.provider);
    await db.update(webhookEvents).set({ status: "processed", processedAt: new Date(), producedEventCount: produced }).where(eq(webhookEvents.id, stored.id));
    return { webhookId: stored.id, status: "processed", produced };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhook:${input.provider}]`, message);
    await db.update(webhookEvents).set({ status: "failed", error: message.slice(0, 1000) }).where(eq(webhookEvents.id, stored.id));
    return { webhookId: stored.id, status: "failed", produced: 0, error: message };
  }
}

/** Find the artist that owns an external account (Instagram business id / Shopify shop domain). */
export async function findArtistForAccount(provider: IntegrationProvider, externalAccountId: string): Promise<string | null> {
  const [row] = await db
    .select({ artistId: integrations.artistId })
    .from(integrations)
    .where(eq(integrations.externalAccountId, externalAccountId))
    .limit(1);
  return row?.artistId ?? null;
}

const KEEP_HEADERS = ["x-shopify-topic", "x-shopify-shop-domain", "x-shopify-webhook-id", "x-shopify-api-version", "x-hub-signature-256", "tiktok-signature", "content-type", "user-agent"];

function pickHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of KEEP_HEADERS) if (headers[k]) out[k] = k.includes("signature") ? "[present]" : headers[k];
  return out;
}

export function headersToRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v;
  });
  return out;
}
