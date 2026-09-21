import { NextResponse, type NextRequest } from "next/server";
import { sha256, verifyMetaSignature } from "@/lib/crypto";
import { env, features } from "@/lib/env";
import { findArtistForAccount, headersToRecord, processWebhook } from "@/lib/webhooks/process";

export const runtime = "nodejs";

/** Meta webhook verification handshake. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && env.META_WEBHOOK_VERIFY_TOKEN && params.get("hub.verify_token") === env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "Verification failed" }, { status: 403 });
}

/**
 * Instagram webhooks (object=instagram). Signature is verified against the
 * raw body; the payload is stored before any processing; each entry is
 * routed to the artist whose professional account it belongs to.
 */
export async function POST(req: NextRequest) {
  if (!features.instagram) return NextResponse.json({ error: "Instagram integration is not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), env.META_APP_SECRET!)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: { object?: string; entry?: { id?: string; time?: number; changes?: unknown[]; messaging?: { recipient?: { id?: string } }[] }[] };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (payload.object !== "instagram") return NextResponse.json({ ok: true, ignored: true });

  const headers = headersToRecord(req.headers);
  const results = [];
  for (const entry of payload.entry ?? []) {
    // entry.id is the Instagram professional account id for change events;
    // messaging events carry the account as the recipient.
    const accountId = entry.id ?? entry.messaging?.[0]?.recipient?.id ?? null;
    const artistId = accountId ? await findArtistForAccount("instagram", accountId) : null;
    const externalEventId = `${accountId ?? "unknown"}:${entry.time ?? ""}:${hashEntry(entry)}`;
    results.push(
      await processWebhook({
        provider: "instagram",
        artistId,
        externalEventId,
        topic: entry.changes ? "changes" : entry.messaging ? "messaging" : null,
        payload: { object: "instagram", entry: [entry] },
        headers,
      }),
    );
  }
  // Always 200 quickly; failures are recorded in webhook_events for retry.
  return NextResponse.json({ ok: true, results: results.map((r) => r.status) });
}

function hashEntry(entry: unknown): string {
  return sha256(JSON.stringify(entry)).slice(0, 16);
}
