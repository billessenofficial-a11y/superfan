import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb, type Database, type DbOrTx } from "@/db";
import { artistFans, artists, fans, referrals } from "@/db/schema";
import { track } from "@/lib/audit";
import { appUrl } from "@/lib/env";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { awardPoints } from "@/lib/points/ledger";
import { REFERRAL_POINTS_DEFAULT } from "@/lib/scoring/defaults";

export class ReferralError extends Error {
  constructor(
    public readonly code: "invalid_code" | "self_referral" | "already_referred" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "ReferralError";
  }
}

export function referralLink(artistSlug: string, code: string): string {
  return appUrl(`/a/${artistSlug}?ref=${code}`);
}

export async function findReferrer(tx: DbOrTx, artistId: string, code: string) {
  const [row] = await tx
    .select({ fanId: artistFans.fanId, referralCode: artistFans.referralCode })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.referralCode, code.trim().toUpperCase())))
    .limit(1);
  return row ?? null;
}

/**
 * Record that `referredFanId` arrived via `code`. Pending until qualified.
 * Idempotent per referred fan; self-referrals are rejected.
 */
export async function recordReferral(
  tx: DbOrTx,
  input: { artistId: string; code: string; referredFanId: string },
) {
  const referrer = await findReferrer(tx, input.artistId, input.code);
  if (!referrer) throw new ReferralError("invalid_code", "That referral link is not valid.");
  if (referrer.fanId === input.referredFanId) throw new ReferralError("self_referral", "You cannot refer yourself.");

  const [existing] = await tx
    .select()
    .from(referrals)
    .where(and(eq(referrals.artistId, input.artistId), eq(referrals.referredFanId, input.referredFanId)))
    .limit(1);
  if (existing) return { referral: existing, created: false };

  // A fan who was already active with this artist cannot be "referred".
  const [af] = await tx
    .select({ joinedAt: artistFans.joinedAt, firstSeenAt: artistFans.firstSeenAt, lastActiveAt: artistFans.lastActiveAt })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, input.artistId), eq(artistFans.fanId, input.referredFanId)))
    .limit(1);
  if (af?.joinedAt && Date.now() - af.joinedAt.getTime() > 60 * 60 * 1000) {
    throw new ReferralError("already_referred", "This fan already joined before using the link.");
  }

  const [referral] = await tx
    .insert(referrals)
    .values({
      artistId: input.artistId,
      referrerFanId: referrer.fanId,
      referredFanId: input.referredFanId,
      referralCode: referrer.referralCode,
      status: "pending",
    })
    .onConflictDoNothing()
    .returning();
  if (!referral) {
    const [raced] = await tx
      .select()
      .from(referrals)
      .where(and(eq(referrals.artistId, input.artistId), eq(referrals.referredFanId, input.referredFanId)))
      .limit(1);
    return { referral: raced, created: false };
  }
  return { referral, created: true };
}

/**
 * A referral qualifies once the referred fan has verified their email,
 * joined the artist and completed at least one meaningful action. Called
 * after such actions; idempotent.
 */
export async function tryQualifyReferral(
  input: { artistId: string; referredFanId: string },
  conn: Database = defaultDb,
) {
  return conn.transaction(async (tx) => {
    const [referral] = await tx
      .select()
      .from(referrals)
      .where(and(eq(referrals.artistId, input.artistId), eq(referrals.referredFanId, input.referredFanId)))
      .for("update");
    if (!referral || referral.status !== "pending") return null;

    const [fan] = await tx.select({ emailVerifiedAt: fans.emailVerifiedAt }).from(fans).where(eq(fans.id, input.referredFanId)).limit(1);
    const [af] = await tx
      .select()
      .from(artistFans)
      .where(and(eq(artistFans.artistId, input.artistId), eq(artistFans.fanId, input.referredFanId)))
      .limit(1);
    if (!fan?.emailVerifiedAt || !af?.joinedAt) return null;

    const meaningful =
      af.ordersCount > 0 ||
      af.eventsAttendedCount > 0 ||
      af.challengesCompletedCount > 0 ||
      af.instagramInteractionsCount > 0 ||
      af.referralsCount > 0;
    if (!meaningful) return null;

    const [updated] = await tx
      .update(referrals)
      .set({ status: "qualified", qualifiedAt: new Date() })
      .where(and(eq(referrals.id, referral.id), eq(referrals.status, "pending")))
      .returning();
    if (!updated) return null;

    const [artist] = await tx.select({ settings: artists.settings }).from(artists).where(eq(artists.id, input.artistId)).limit(1);
    const points = typeof artist?.settings?.referralPoints === "number" ? artist.settings.referralPoints : REFERRAL_POINTS_DEFAULT;

    await awardPoints(tx, {
      artistId: input.artistId,
      fanId: referral.referrerFanId,
      amount: points,
      type: "REFERRAL",
      sourceId: referral.id,
      description: "Referred a friend",
    });

    const [referred] = await tx.select({ firstName: fans.firstName }).from(fans).where(eq(fans.id, referral.referredFanId)).limit(1);
    await ingestEvent(
      {
        artistId: input.artistId,
        fanId: referral.referrerFanId,
        source: "superfan",
        type: EVENT_TYPES.fanReferralCompleted,
        sourceEventId: `referral:${referral.id}`,
        metadata: { referralId: referral.id, referredFanId: referral.referredFanId },
        summary: referred?.firstName ? `Referred ${referred.firstName}` : "Referred a friend",
      },
      tx,
    );
    await track(tx, "referral_completed", { artistId: input.artistId, fanId: referral.referrerFanId }, { referralId: referral.id });
    return updated;
  });
}

export async function referralStats(tx: DbOrTx, artistId: string, fanId: string) {
  const [row] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      qualified: sql<number>`count(*) filter (where ${referrals.status} = 'qualified')::int`,
      pending: sql<number>`count(*) filter (where ${referrals.status} = 'pending')::int`,
    })
    .from(referrals)
    .where(and(eq(referrals.artistId, artistId), eq(referrals.referrerFanId, fanId)));
  return row ?? { total: 0, qualified: 0, pending: 0 };
}
