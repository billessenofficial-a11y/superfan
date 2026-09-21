import { NextResponse, type NextRequest } from "next/server";
import { verifyShopifyHmac } from "@/lib/crypto";
import { env, features } from "@/lib/env";
import { markDisconnected } from "@/lib/integrations/store";
import { findArtistForAccount, headersToRecord, processWebhook } from "@/lib/webhooks/process";

export const runtime = "nodejs";

/**
 * Shopify webhooks (orders/create, refunds/create, orders/cancelled, app/uninstalled).
 * HMAC is verified against the raw body with the app's client secret.
 * Redeliveries are deduped by X-Shopify-Webhook-Id.
 */
export async function POST(req: NextRequest) {
  if (!features.shopify) return NextResponse.json({ error: "Shopify integration is not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyShopifyHmac(raw, req.headers.get("x-shopify-hmac-sha256"), env.SHOPIFY_CLIENT_SECRET!)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const headers = headersToRecord(req.headers);
  const shop = headers["x-shopify-shop-domain"] ?? null;
  const topic = headers["x-shopify-topic"] ?? null;
  const artistId = shop ? await findArtistForAccount("shopify", shop) : null;

  if (topic === "app/uninstalled" && artistId) {
    await markDisconnected({ artistId, provider: "shopify", actorUserId: null });
    return NextResponse.json({ ok: true });
  }

  const result = await processWebhook({
    provider: "shopify",
    artistId,
    externalEventId: headers["x-shopify-webhook-id"] ?? null,
    topic,
    payload,
    headers,
  });
  return NextResponse.json({ ok: true, status: result.status, produced: result.produced });
}
