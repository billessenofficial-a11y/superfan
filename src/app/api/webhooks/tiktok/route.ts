import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { artistFans, fanIdentities } from "@/db/schema";
import { verifyTikTokSignature } from "@/lib/crypto";
import { env, features } from "@/lib/env";
import { headersToRecord, processWebhook } from "@/lib/webhooks/process";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/**
 * TikTok webhooks. TikTok may deliver the same event more than once, so the
 * event is deduped on (event, user_openid, create_time). Only account-level
 * events are handled; content scopes are not requested.
 */
export async function POST(req: NextRequest) {
  if (!features.tiktok) return NextResponse.json({ error: "TikTok integration is not configured" }, { status: 503 });
  const raw = await req.text();
  if (!verifyTikTokSignature(raw, req.headers.get("tiktok-signature"), env.TIKTOK_CLIENT_SECRET!)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: { event?: string; user_openid?: string; create_time?: number };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  // TikTok identities are fan-scoped (not per artist): find the fan, then their artists.
  const openId = payload.user_openid ?? null;
  const [identity] = openId
    ? await db.select({ fanId: fanIdentities.fanId }).from(fanIdentities).where(eq(fanIdentities.externalUserId, openId)).limit(1)
    : [];
  const artistId = identity?.fanId ? await firstArtistForFan(identity.fanId) : null;
  const result = await processWebhook({
    provider: "tiktok",
    artistId,
    externalEventId: `${payload.event ?? "event"}:${openId ?? "unknown"}:${payload.create_time ?? ""}`,
    topic: payload.event ?? null,
    payload,
    headers: headersToRecord(req.headers),
  });
  return NextResponse.json({ ok: true, status: result.status });
}

async function firstArtistForFan(fanId: string): Promise<string | null> {
  const [row] = await db.select({ artistId: artistFans.artistId }).from(artistFans).where(eq(artistFans.fanId, fanId)).limit(1);
  return row?.artistId ?? null;
}
