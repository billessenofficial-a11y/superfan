import { and, asc, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/db";
import {
  artistEvents,
  artistFans,
  artists,
  badges,
  challengeCompletions,
  challenges,
  eventCheckins,
  fanBadges,
  fanEvents,
  fanIdentities,
  fanLevels,
  fans,
  rewardPointTransactions,
  rewardRedemptions,
  rewards,
} from "@/db/schema";
import { checkinWindow } from "@/lib/checkins";
import { referralLink, referralStats } from "@/lib/referrals";
import { checkRewardEligibility } from "@/lib/rewards/redeem";

/** Artists the fan has a relationship with (for /fan). */
export async function getFanArtists(fanId: string, conn: DbOrTx = defaultDb) {
  return conn
    .select({
      artist: { id: artists.id, name: artists.name, slug: artists.slug, avatarUrl: artists.avatarUrl, bannerUrl: artists.bannerUrl, accentColor: artists.accentColor, genre: artists.genre },
      superfanScore: artistFans.superfanScore,
      rewardPoints: artistFans.rewardPointsCached,
      levelName: fanLevels.name,
      levelColor: fanLevels.color,
      joinedAt: artistFans.joinedAt,
      firstSeenAt: artistFans.firstSeenAt,
      lastActiveAt: artistFans.lastActiveAt,
    })
    .from(artistFans)
    .innerJoin(artists, eq(artists.id, artistFans.artistId))
    .leftJoin(fanLevels, eq(fanLevels.id, artistFans.levelId))
    .where(eq(artistFans.fanId, fanId))
    .orderBy(desc(artistFans.superfanScore));
}

/** Public artist profile for /artists/[slug]. */
export async function getArtistPublic(slug: string, conn: DbOrTx = defaultDb) {
  const [artist] = await conn.select().from(artists).where(eq(artists.slug, slug)).limit(1);
  if (!artist) return null;
  const [stats] = await conn
    .select({
      fans: sql<number>`count(*)::int`,
      joined: sql<number>`count(*) filter (where ${artistFans.joinedAt} is not null)::int`,
    })
    .from(artistFans)
    .where(eq(artistFans.artistId, artist.id));
  const [activeRewards] = await conn.select({ count: sql<number>`count(*)::int` }).from(rewards).where(and(eq(rewards.artistId, artist.id), eq(rewards.status, "active")));
  const [activeChallenges] = await conn.select({ count: sql<number>`count(*)::int` }).from(challenges).where(and(eq(challenges.artistId, artist.id), eq(challenges.status, "active")));
  const upcoming = await conn
    .select({ id: artistEvents.id, name: artistEvents.name, city: artistEvents.city, venue: artistEvents.venue, startsAt: artistEvents.startsAt })
    .from(artistEvents)
    .where(and(eq(artistEvents.artistId, artist.id), inArray(artistEvents.status, ["upcoming", "live"]), gte(artistEvents.startsAt, new Date(Date.now() - 12 * 3600_000))))
    .orderBy(asc(artistEvents.startsAt))
    .limit(4);
  const levels = await conn.select().from(fanLevels).where(eq(fanLevels.artistId, artist.id)).orderBy(fanLevels.sortOrder);
  return { artist, stats: { ...stats, activeRewards: activeRewards.count, activeChallenges: activeChallenges.count }, upcoming, levels };
}

/**
 * Everything the passport needs for one fan + artist, in one call.
 */
export async function getPassport(fanId: string, artistSlug: string, conn: DbOrTx = defaultDb) {
  const [artist] = await conn.select().from(artists).where(eq(artists.slug, artistSlug)).limit(1);
  if (!artist) return null;
  const [membership] = await conn.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, fanId))).limit(1);
  if (!membership) return { artist, membership: null } as const;

  const now = new Date();
  const [levels, allBadges, earned, badgeCounts, [{ totalFans }], [{ above }], timeline, activeChallenges, completions, activeRewards, redemptions, events, checkins, identities, refs, pointTx] = await Promise.all([
    conn.select().from(fanLevels).where(eq(fanLevels.artistId, artist.id)).orderBy(fanLevels.sortOrder),
    conn.select().from(badges).where(or(isNull(badges.artistId), eq(badges.artistId, artist.id))).orderBy(badges.sortOrder),
    conn.select({ badgeId: fanBadges.badgeId, earnedAt: fanBadges.earnedAt }).from(fanBadges).where(and(eq(fanBadges.artistId, artist.id), eq(fanBadges.fanId, fanId))),
    conn.select({ badgeId: fanBadges.badgeId, count: sql<number>`count(*)::int` }).from(fanBadges).where(eq(fanBadges.artistId, artist.id)).groupBy(fanBadges.badgeId),
    conn.select({ totalFans: sql<number>`count(*)::int` }).from(artistFans).where(eq(artistFans.artistId, artist.id)),
    conn.select({ above: sql<number>`count(*)::int` }).from(artistFans).where(and(eq(artistFans.artistId, artist.id), sql`${artistFans.superfanScore} > ${membership.superfanScore}`)),
    conn.select().from(fanEvents).where(and(eq(fanEvents.artistId, artist.id), eq(fanEvents.fanId, fanId))).orderBy(desc(fanEvents.occurredAt)).limit(60),
    conn.select().from(challenges).where(and(eq(challenges.artistId, artist.id), eq(challenges.status, "active"), or(isNull(challenges.startsAt), sql`${challenges.startsAt} <= now()`))).orderBy(desc(challenges.points)),
    conn.select().from(challengeCompletions).where(and(eq(challengeCompletions.artistId, artist.id), eq(challengeCompletions.fanId, fanId))),
    conn.select().from(rewards).where(and(eq(rewards.artistId, artist.id), eq(rewards.status, "active"))).orderBy(asc(rewards.pointCost)),
    conn.select({ redemption: rewardRedemptions, reward: rewards }).from(rewardRedemptions).innerJoin(rewards, eq(rewards.id, rewardRedemptions.rewardId)).where(and(eq(rewardRedemptions.artistId, artist.id), eq(rewardRedemptions.fanId, fanId))).orderBy(desc(rewardRedemptions.redeemedAt)),
    conn.select().from(artistEvents).where(and(eq(artistEvents.artistId, artist.id), inArray(artistEvents.status, ["upcoming", "live", "completed"]))).orderBy(desc(artistEvents.startsAt)).limit(12),
    conn.select().from(eventCheckins).where(and(eq(eventCheckins.artistId, artist.id), eq(eventCheckins.fanId, fanId))),
    conn.select().from(fanIdentities).where(and(eq(fanIdentities.fanId, fanId), or(isNull(fanIdentities.artistId), eq(fanIdentities.artistId, artist.id)))),
    referralStats(conn, artist.id, fanId),
    conn.select().from(rewardPointTransactions).where(and(eq(rewardPointTransactions.artistId, artist.id), eq(rewardPointTransactions.fanId, fanId))).orderBy(desc(rewardPointTransactions.createdAt)).limit(30),
  ]);

  const level = levels.find((l) => l.id === membership.levelId) ?? null;
  const nextLevel = levels.find((l) => l.minScore > membership.superfanScore) ?? null;
  const topPercent = totalFans > 0 ? Math.max(1, Math.ceil(((above + 1) / totalFans) * 100)) : 100;
  const earnedMap = new Map(earned.map((e) => [e.badgeId, e.earnedAt]));
  const countMap = new Map(badgeCounts.map((c) => [c.badgeId, c.count]));
  const completedIds = new Set(completions.map((c) => c.challengeId));
  const checkedInIds = new Set(checkins.map((c) => c.eventId));
  const redemptionCount = new Map<string, number>();
  for (const r of redemptions) if (r.redemption.status !== "cancelled") redemptionCount.set(r.reward.id, (redemptionCount.get(r.reward.id) ?? 0) + 1);

  const [fanRow] = await conn.select({ city: fans.city, country: fans.country }).from(fans).where(eq(fans.id, fanId)).limit(1);

  const rewardsWithEligibility = await Promise.all(
    activeRewards.map(async (r) => ({
      reward: r,
      eligibility: await checkRewardEligibility(conn, r, membership, fanRow ?? { city: null, country: null }, redemptionCount.get(r.id) ?? 0, now),
      redeemedByFan: redemptionCount.get(r.id) ?? 0,
    })),
  );

  return {
    artist,
    membership,
    level,
    nextLevel,
    levels,
    topPercent,
    totalFans,
    badges: allBadges.map((b) => ({
      badge: b,
      earnedAt: earnedMap.get(b.id) ?? null,
      rarityPercent: totalFans > 0 ? Math.max(1, Math.round(((countMap.get(b.id) ?? 0) / totalFans) * 100)) : 0,
    })),
    timeline,
    challenges: activeChallenges.map((c) => ({ challenge: c, completed: completedIds.has(c.id), completion: completions.find((x) => x.challengeId === c.id) ?? null })),
    rewards: rewardsWithEligibility,
    redemptions,
    events: events.map((e) => ({ event: e, checkedIn: checkedInIds.has(e.id), window: checkinWindow(e, now), isUpcoming: e.startsAt.getTime() >= now.getTime() - 6 * 3600_000 })),
    identities,
    referrals: { ...refs, link: referralLink(artist.slug, membership.referralCode), code: membership.referralCode },
    pointTransactions: pointTx,
  } as const;
}

export type Passport = NonNullable<Awaited<ReturnType<typeof getPassport>>>;
export type FullPassport = Extract<Passport, { level: unknown }>;
