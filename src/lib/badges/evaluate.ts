import { and, eq, isNull, or } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { artistFans, badges, challengeCompletions, fanBadges, fanLevels, type BadgeCriteria } from "@/db/schema";

export type Badge = typeof badges.$inferSelect;

export async function loadBadgesForArtist(tx: DbOrTx, artistId: string): Promise<Badge[]> {
  return tx
    .select()
    .from(badges)
    .where(or(isNull(badges.artistId), eq(badges.artistId, artistId)))
    .orderBy(badges.sortOrder);
}

type FanContext = {
  eventsAttendedCount: number;
  lifetimeSpendCents: number;
  referralsCount: number;
  firstSeenAt: Date;
  joinedAt: Date | null;
  levelSortOrder: number;
  completedChallengeIds: Set<string>;
};

function meets(criteria: BadgeCriteria, ctx: FanContext): boolean {
  switch (criteria.kind) {
    case "events_attended":
      return ctx.eventsAttendedCount >= criteria.count;
    case "lifetime_spend_cents":
      return ctx.lifetimeSpendCents >= criteria.amount;
    case "referrals":
      return ctx.referralsCount >= criteria.count;
    case "member_before": {
      const joined = ctx.joinedAt ?? ctx.firstSeenAt;
      return joined.getTime() <= new Date(criteria.date).getTime();
    }
    case "challenge_completed":
      return ctx.completedChallengeIds.has(criteria.challengeId);
    case "level_reached":
      return ctx.levelSortOrder >= criteria.levelSortOrder;
    case "manual":
      return false;
  }
}

/**
 * Award any badges the fan now qualifies for. Returns the newly earned badges.
 * Idempotent: existing fan_badges rows are never duplicated.
 */
export async function evaluateBadges(tx: DbOrTx, artistId: string, fanId: string): Promise<Badge[]> {
  const [af] = await tx
    .select({
      eventsAttendedCount: artistFans.eventsAttendedCount,
      lifetimeSpendCents: artistFans.lifetimeSpendCents,
      referralsCount: artistFans.referralsCount,
      firstSeenAt: artistFans.firstSeenAt,
      joinedAt: artistFans.joinedAt,
      levelId: artistFans.levelId,
    })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)))
    .limit(1);
  if (!af) return [];

  let levelSortOrder = -1;
  if (af.levelId) {
    const [lvl] = await tx
      .select({ sortOrder: fanLevels.sortOrder })
      .from(fanLevels)
      .where(eq(fanLevels.id, af.levelId))
      .limit(1);
    levelSortOrder = lvl?.sortOrder ?? -1;
  }

  const completions = await tx
    .select({ challengeId: challengeCompletions.challengeId })
    .from(challengeCompletions)
    .where(and(eq(challengeCompletions.artistId, artistId), eq(challengeCompletions.fanId, fanId)));

  const ctx: FanContext = {
    ...af,
    levelSortOrder,
    completedChallengeIds: new Set(completions.map((c) => c.challengeId)),
  };

  const all = await loadBadgesForArtist(tx, artistId);
  const owned = await tx
    .select({ badgeId: fanBadges.badgeId })
    .from(fanBadges)
    .where(and(eq(fanBadges.artistId, artistId), eq(fanBadges.fanId, fanId)));
  const ownedIds = new Set(owned.map((o) => o.badgeId));

  const earned: Badge[] = [];
  for (const badge of all) {
    if (ownedIds.has(badge.id)) continue;
    if (!meets(badge.criteria, ctx)) continue;
    const [row] = await tx
      .insert(fanBadges)
      .values({ artistId, fanId, badgeId: badge.id })
      .onConflictDoNothing()
      .returning({ id: fanBadges.id });
    if (row) earned.push(badge);
  }
  return earned;
}

/** Manually grant a badge (artist action). */
export async function grantBadge(tx: DbOrTx, artistId: string, fanId: string, badgeId: string) {
  const [row] = await tx
    .insert(fanBadges)
    .values({ artistId, fanId, badgeId })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}
