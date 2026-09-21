import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  artistFans,
  campaignParticipants,
  claimTokens,
  fanEvents,
  fanIdentities,
  fanNotes,
  fans,
  importRows,
  referrals,
  rewardPointTransactions,
  rewardRedemptions,
  scoreLedger,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { evaluateBadges } from "@/lib/badges/evaluate";
import { refreshPointBalance } from "@/lib/points/ledger";
import { recomputeFanScore } from "@/lib/scoring/engine";
import { enrichFanProfile, ensureArtistFan } from "./resolver";

/**
 * Merge `sourceFanId` into `targetFanId`. All artist relationships, events,
 * ledgers and identities move to the target; the source is tombstoned with
 * `merged_into_fan_id`. Caches for every affected artist are recomputed.
 *
 * Only ever called from explicit flows: identity claims (the fan proves
 * ownership) or an artist-approved manual merge. Never from heuristics.
 */
export async function mergeFans(
  tx: DbOrTx,
  input: { sourceFanId: string; targetFanId: string; actorUserId: string | null; reason: string; artistId?: string | null },
) {
  const { sourceFanId, targetFanId } = input;
  if (sourceFanId === targetFanId) return { movedArtists: [] as string[] };

  const [source] = await tx.select().from(fans).where(eq(fans.id, sourceFanId)).for("update");
  const [target] = await tx.select().from(fans).where(eq(fans.id, targetFanId)).for("update");
  if (!source || !target) throw new Error("Fan not found");
  if (source.mergedIntoFanId) throw new Error("Source fan was already merged");

  // Profile enrichment: keep target's values, fill blanks from source.
  await enrichFanProfile(tx, targetFanId, {
    firstName: source.firstName ?? undefined,
    lastName: source.lastName ?? undefined,
    city: source.city ?? undefined,
    region: source.region ?? undefined,
    country: source.country ?? undefined,
    avatarUrl: source.avatarUrl ?? undefined,
  });

  // Free the source's unique email/phone before tombstoning.
  await tx
    .update(fans)
    .set({ email: null, phone: null, mergedIntoFanId: targetFanId, userId: null })
    .where(eq(fans.id, sourceFanId));

  const sourceArtistRows = await tx.select().from(artistFans).where(eq(artistFans.fanId, sourceFanId));
  const artistIds = sourceArtistRows.map((r) => r.artistId);

  for (const row of sourceArtistRows) {
    await ensureArtistFan(tx, row.artistId, targetFanId, { firstSeenAt: row.firstSeenAt, firstSource: row.firstSource ?? undefined });
    await tx
      .update(artistFans)
      .set({
        firstSeenAt: sql`least(${artistFans.firstSeenAt}, ${row.firstSeenAt.toISOString()}::timestamptz)`,
        lastActiveAt: sql`greatest(coalesce(${artistFans.lastActiveAt}, 'epoch'::timestamptz), coalesce(${row.lastActiveAt?.toISOString() ?? null}::timestamptz, 'epoch'::timestamptz))`,
        joinedAt: sql`coalesce(${artistFans.joinedAt}, ${row.joinedAt?.toISOString() ?? null}::timestamptz)`,
        lifetimeSpendCents: sql`${artistFans.lifetimeSpendCents} + ${row.lifetimeSpendCents}`,
        ordersCount: sql`${artistFans.ordersCount} + ${row.ordersCount}`,
        eventsAttendedCount: sql`${artistFans.eventsAttendedCount} + ${row.eventsAttendedCount}`,
        referralsCount: sql`${artistFans.referralsCount} + ${row.referralsCount}`,
        instagramInteractionsCount: sql`${artistFans.instagramInteractionsCount} + ${row.instagramInteractionsCount}`,
        challengesCompletedCount: sql`${artistFans.challengesCompletedCount} + ${row.challengesCompletedCount}`,
      })
      .where(and(eq(artistFans.artistId, row.artistId), eq(artistFans.fanId, targetFanId)));
  }
  await tx.delete(artistFans).where(eq(artistFans.fanId, sourceFanId));

  // Move everything keyed by fan_id.
  const moveFan = { fanId: targetFanId } as const;
  await tx.update(fanEvents).set(moveFan).where(eq(fanEvents.fanId, sourceFanId));
  await tx.update(scoreLedger).set(moveFan).where(eq(scoreLedger.fanId, sourceFanId));
  await tx.update(rewardPointTransactions).set(moveFan).where(eq(rewardPointTransactions.fanId, sourceFanId));
  await tx.update(fanIdentities).set(moveFan).where(eq(fanIdentities.fanId, sourceFanId));
  await tx.update(fanNotes).set(moveFan).where(eq(fanNotes.fanId, sourceFanId));
  await tx.update(importRows).set(moveFan).where(eq(importRows.fanId, sourceFanId));
  await tx.update(claimTokens).set({ claimedByFanId: targetFanId }).where(eq(claimTokens.claimedByFanId, sourceFanId));
  await tx.update(rewardRedemptions).set(moveFan).where(eq(rewardRedemptions.fanId, sourceFanId));
  await tx.update(campaignParticipants).set(moveFan).where(eq(campaignParticipants.fanId, sourceFanId));

  // Tables with (x, fan_id) uniqueness: move what does not collide, drop the rest.
  await moveUnique(tx, "fan_badges", "fan_id", "badge_id", sourceFanId, targetFanId);
  await moveUnique(tx, "challenge_completions", "fan_id", "challenge_id", sourceFanId, targetFanId);
  await moveUnique(tx, "event_checkins", "fan_id", "event_id", sourceFanId, targetFanId);
  await moveUnique(tx, "fan_tag_assignments", "fan_id", "tag_id", sourceFanId, targetFanId);
  await moveUnique(tx, "score_snapshots", "fan_id", "snapshot_date", sourceFanId, targetFanId);

  // Referrals: referrer side moves freely; referred side is unique per artist.
  await tx.update(referrals).set({ referrerFanId: targetFanId }).where(eq(referrals.referrerFanId, sourceFanId));
  await tx.delete(referrals).where(and(eq(referrals.referredFanId, sourceFanId), eq(referrals.referrerFanId, targetFanId)));
  await moveUnique(tx, "referrals", "referred_fan_id", "artist_id", sourceFanId, targetFanId);
  await tx.delete(referrals).where(eq(referrals.referrerFanId, referrals.referredFanId));

  // Re-derive every cache from the (now combined) ledgers.
  for (const artistId of new Set(artistIds)) {
    await recomputeFanScore(tx, artistId, targetFanId);
    await refreshPointBalance(tx, artistId, targetFanId);
    await evaluateBadges(tx, artistId, targetFanId);
  }

  await audit(tx, {
    artistId: input.artistId ?? artistIds[0] ?? null,
    actorUserId: input.actorUserId,
    action: "fan.merged",
    targetType: "fan",
    targetId: targetFanId,
    metadata: { sourceFanId, reason: input.reason, artists: artistIds },
  });

  return { movedArtists: artistIds };
}

/**
 * For tables unique on (keyCol, fanCol): drop source rows whose key already
 * exists on the target, then re-point the rest. Identifiers are constants
 * from this module, never user input.
 */
async function moveUnique(tx: DbOrTx, table: string, fanCol: string, keyCol: string, sourceFanId: string, targetFanId: string) {
  const t = sql.identifier(table);
  const f = sql.identifier(fanCol);
  const k = sql.identifier(keyCol);
  await tx.execute(sql`
    delete from ${t} src
    where src.${f} = ${sourceFanId}
      and exists (select 1 from ${t} dst where dst.${f} = ${targetFanId} and dst.${k} = src.${k})
  `);
  await tx.execute(sql`update ${t} set ${f} = ${targetFanId} where ${f} = ${sourceFanId}`);
}
