import { and, eq } from "drizzle-orm";
import { db as defaultDb, type Database, type DbOrTx } from "@/db";
import { artistFans, artists, claimTokens, fanIdentities, fans } from "@/db/schema";
import { track } from "@/lib/audit";
import { randomToken, sha256 } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { mergeFans } from "@/lib/identity/merge";
import { canonicalFanId, ensureArtistFan } from "@/lib/identity/resolver";

export class ClaimError extends Error {
  constructor(
    public readonly code: "invalid" | "expired" | "used" | "revoked" | "already_claimed" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "ClaimError";
  }
}

export const CLAIM_TOKEN_TTL_HOURS = 72;

/**
 * Create a single-use claim link for an external identity. The raw token
 * is returned once and only its hash is stored.
 */
export async function createClaimToken(
  tx: DbOrTx,
  input: { artistId: string; identityId: string; ttlHours?: number },
) {
  const [identity] = await tx
    .select({ id: fanIdentities.id, provider: fanIdentities.provider })
    .from(fanIdentities)
    .where(eq(fanIdentities.id, input.identityId))
    .limit(1);
  if (!identity) throw new ClaimError("not_found", "Identity not found.");

  const token = randomToken(24);
  const expiresAt = new Date(Date.now() + (input.ttlHours ?? CLAIM_TOKEN_TTL_HOURS) * 3600_000);
  const [row] = await tx
    .insert(claimTokens)
    .values({
      artistId: input.artistId,
      identityId: identity.id,
      provider: identity.provider,
      tokenHash: sha256(token),
      expiresAt,
    })
    .returning();
  return { token, url: appUrl(`/claim/${token}`), record: row };
}

export type ClaimPreview = {
  tokenId: string;
  artist: { id: string; name: string; slug: string; avatarUrl: string | null; accentColor: string };
  identity: { id: string; provider: string; username: string | null; displayName: string | null; avatarUrl: string | null };
  activity: { score: number; eventsAttended: number; lifetimeSpendCents: number; interactions: number } | null;
  expiresAt: Date;
};

/** Look up a token for display without consuming it. */
export async function previewClaim(tx: DbOrTx, token: string): Promise<ClaimPreview> {
  const [row] = await tx.select().from(claimTokens).where(eq(claimTokens.tokenHash, sha256(token))).limit(1);
  if (!row) throw new ClaimError("invalid", "This claim link is not valid.");
  if (row.status === "used") throw new ClaimError("used", "This link has already been used.");
  if (row.status === "revoked") throw new ClaimError("revoked", "This link was revoked.");
  if (row.expiresAt < new Date()) throw new ClaimError("expired", "This link has expired. Comment again to get a new one.");

  const [artist] = await tx
    .select({ id: artists.id, name: artists.name, slug: artists.slug, avatarUrl: artists.avatarUrl, accentColor: artists.accentColor })
    .from(artists)
    .where(eq(artists.id, row.artistId))
    .limit(1);
  const [identity] = await tx.select().from(fanIdentities).where(eq(fanIdentities.id, row.identityId)).limit(1);
  if (!artist || !identity) throw new ClaimError("not_found", "Identity not found.");
  if (identity.claimed) throw new ClaimError("already_claimed", "This account has already been claimed.");

  let activity: ClaimPreview["activity"] = null;
  if (identity.fanId) {
    const [af] = await tx
      .select({
        score: artistFans.superfanScore,
        eventsAttended: artistFans.eventsAttendedCount,
        lifetimeSpendCents: artistFans.lifetimeSpendCents,
        interactions: artistFans.instagramInteractionsCount,
      })
      .from(artistFans)
      .where(and(eq(artistFans.artistId, row.artistId), eq(artistFans.fanId, identity.fanId)))
      .limit(1);
    activity = af ?? null;
  }

  return {
    tokenId: row.id,
    artist,
    identity: { id: identity.id, provider: identity.provider, username: identity.username, displayName: identity.displayName, avatarUrl: identity.avatarUrl },
    activity,
    expiresAt: row.expiresAt,
  };
}

/**
 * Consume a claim token: attach the external identity (and any shadow fan
 * history behind it) to the authenticated fan. Single use.
 */
export async function claimIdentity(
  input: { token: string; fanId: string },
  conn: Database = defaultDb,
) {
  return conn.transaction(async (tx) => {
    const [row] = await tx.select().from(claimTokens).where(eq(claimTokens.tokenHash, sha256(input.token))).for("update");
    if (!row) throw new ClaimError("invalid", "This claim link is not valid.");
    if (row.status === "used") throw new ClaimError("used", "This link has already been used.");
    if (row.status === "revoked") throw new ClaimError("revoked", "This link was revoked.");
    if (row.expiresAt < new Date()) throw new ClaimError("expired", "This link has expired.");

    const targetFanId = await canonicalFanId(tx, input.fanId);
    const [identity] = await tx.select().from(fanIdentities).where(eq(fanIdentities.id, row.identityId)).for("update");
    if (!identity) throw new ClaimError("not_found", "Identity not found.");
    if (identity.claimed && identity.fanId !== targetFanId) {
      throw new ClaimError("already_claimed", "This account has already been claimed by someone else.");
    }

    // Mark the token used first so a concurrent request cannot reuse it.
    const [consumed] = await tx
      .update(claimTokens)
      .set({ status: "used", usedAt: new Date(), claimedByFanId: targetFanId })
      .where(and(eq(claimTokens.id, row.id), eq(claimTokens.status, "active")))
      .returning({ id: claimTokens.id });
    if (!consumed) throw new ClaimError("used", "This link has already been used.");

    let merged = false;
    if (identity.fanId && identity.fanId !== targetFanId) {
      const shadowId = await canonicalFanId(tx, identity.fanId);
      if (shadowId !== targetFanId) {
        const [shadow] = await tx.select({ email: fans.email, userId: fans.userId }).from(fans).where(eq(fans.id, shadowId)).limit(1);
        // Only absorb unclaimed shadow profiles automatically. A profile that
        // belongs to another authenticated person needs an artist-approved merge.
        if (shadow && !shadow.userId && !shadow.email) {
          await mergeFans(tx, {
            sourceFanId: shadowId,
            targetFanId,
            actorUserId: null,
            reason: `Identity claim (${identity.provider})`,
            artistId: row.artistId,
          });
          merged = true;
        }
      }
    }

    await tx
      .update(fanIdentities)
      .set({ fanId: targetFanId, claimed: true, claimedAt: new Date() })
      .where(eq(fanIdentities.id, identity.id));

    await ensureArtistFan(tx, row.artistId, targetFanId);

    await ingestEvent(
      {
        artistId: row.artistId,
        fanId: targetFanId,
        source: "superfan",
        type: EVENT_TYPES.fanIdentityClaimed,
        sourceEventId: `claim:${row.id}`,
        metadata: { provider: identity.provider, identityId: identity.id, username: identity.username, merged },
        summary: identity.username ? `Claimed ${identity.provider} account @${identity.username}` : `Claimed ${identity.provider} account`,
      },
      tx,
    );
    await track(tx, "identity_claimed", { artistId: row.artistId, fanId: targetFanId }, { provider: identity.provider, merged });

    return { artistId: row.artistId, identityId: identity.id, fanId: targetFanId, merged };
  });
}

/** Unclaimed identities that a newly signed-in fan might own (shown after signup when a token is present). */
export async function pendingClaimsForToken(tx: DbOrTx, token: string | null) {
  if (!token) return null;
  try {
    return await previewClaim(tx, token);
  } catch {
    return null;
  }
}
