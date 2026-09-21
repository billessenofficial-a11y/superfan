import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/db";
import {
  artistFans,
  badges,
  challengeCompletions,
  challenges,
  eventCheckins,
  artistEvents,
  fanBadges,
  fanEvents,
  fanIdentities,
  fanLevels,
  fanNotes,
  fanTagAssignments,
  fanTags,
  fans,
  rewardPointTransactions,
  rewardRedemptions,
  rewards,
  scoreLedger,
  users,
  type SegmentGroup,
} from "@/db/schema";
import { compileSegment } from "@/lib/segments/query";
import { referralStats } from "@/lib/referrals";

export type FanSort = "score" | "points" | "spend" | "events" | "last_active" | "name" | "first_seen" | "instagram";

export type FanListFilters = {
  search?: string;
  levelId?: string;
  minScore?: number;
  maxScore?: number;
  minPoints?: number;
  maxPoints?: number;
  city?: string;
  country?: string;
  minSpend?: number;
  maxSpend?: number;
  minEvents?: number;
  instagram?: boolean;
  shopify?: boolean;
  lastActiveDays?: number;
  source?: string;
  tagId?: string;
  rules?: SegmentGroup | null;
  sort?: FanSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type FanListRow = {
  fanId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  superfanScore: number;
  rewardPoints: number;
  levelId: string | null;
  levelName: string | null;
  levelColor: string | null;
  lifetimeSpendCents: number;
  eventsAttendedCount: number;
  instagramUsername: string | null;
  instagramClaimed: boolean | null;
  lastActiveAt: Date | null;
  firstSeenAt: Date;
  joinedAt: Date | null;
  hasUser: boolean;
};

const instagramUsernameExpr = sql<string | null>`(select fi.username from fan_identities fi where fi.fan_id = ${artistFans.fanId} and fi.provider = 'instagram' order by fi.claimed desc, fi.last_seen_at desc nulls last limit 1)`;
const instagramClaimedExpr = sql<boolean | null>`(select fi.claimed from fan_identities fi where fi.fan_id = ${artistFans.fanId} and fi.provider = 'instagram' order by fi.claimed desc, fi.last_seen_at desc nulls last limit 1)`;

export function buildFanFilters(artistId: string, f: FanListFilters): SQL[] {
  const where: SQL[] = [eq(artistFans.artistId, artistId), sql`${fans.mergedIntoFanId} is null`, sql`${fans.deletedAt} is null`];
  if (f.search?.trim()) {
    const q = `%${f.search.trim().toLowerCase()}%`;
    where.push(
      sql`(lower(coalesce(${fans.firstName}, '') || ' ' || coalesce(${fans.lastName}, '')) like ${q}
        or lower(coalesce(${fans.email}, '')) like ${q}
        or coalesce(${fans.phone}, '') like ${q}
        or exists (select 1 from fan_identities fi where fi.fan_id = ${fans.id} and lower(coalesce(fi.username, '')) like ${q}))`,
    );
  }
  if (f.levelId) where.push(eq(artistFans.levelId, f.levelId));
  if (f.minScore != null) where.push(sql`${artistFans.superfanScore} >= ${f.minScore}`);
  if (f.maxScore != null) where.push(sql`${artistFans.superfanScore} <= ${f.maxScore}`);
  if (f.minPoints != null) where.push(sql`${artistFans.rewardPointsCached} >= ${f.minPoints}`);
  if (f.maxPoints != null) where.push(sql`${artistFans.rewardPointsCached} <= ${f.maxPoints}`);
  if (f.city) where.push(sql`lower(${fans.city}) = ${f.city.toLowerCase()}`);
  if (f.country) where.push(sql`lower(${fans.country}) = ${f.country.toLowerCase()}`);
  if (f.minSpend != null) where.push(sql`${artistFans.lifetimeSpendCents} >= ${Math.round(f.minSpend * 100)}`);
  if (f.maxSpend != null) where.push(sql`${artistFans.lifetimeSpendCents} <= ${Math.round(f.maxSpend * 100)}`);
  if (f.minEvents != null) where.push(sql`${artistFans.eventsAttendedCount} >= ${f.minEvents}`);
  if (f.instagram) where.push(sql`${artistFans.instagramInteractionsCount} > 0`);
  if (f.shopify) where.push(sql`exists (select 1 from fan_identities fi where fi.fan_id = ${fans.id} and fi.provider = 'shopify')`);
  if (f.lastActiveDays != null) where.push(sql`${artistFans.lastActiveAt} >= now() - make_interval(days => ${f.lastActiveDays})`);
  if (f.source) where.push(sql`${artistFans.firstSource} = ${f.source}::event_source`);
  if (f.tagId) where.push(sql`exists (select 1 from fan_tag_assignments ta where ta.fan_id = ${fans.id} and ta.tag_id = ${f.tagId}::uuid)`);
  if (f.rules) where.push(compileSegment(f.rules));
  return where;
}

function sortExpr(sort: FanSort | undefined, dir: "asc" | "desc") {
  const d = dir === "asc" ? asc : desc;
  switch (sort) {
    case "points":
      return [d(artistFans.rewardPointsCached), desc(artistFans.superfanScore)];
    case "spend":
      return [d(artistFans.lifetimeSpendCents), desc(artistFans.superfanScore)];
    case "events":
      return [d(artistFans.eventsAttendedCount), desc(artistFans.superfanScore)];
    case "last_active":
      return [sql`${artistFans.lastActiveAt} ${sql.raw(dir)} nulls last`];
    case "name":
      return [d(fans.firstName), d(fans.lastName)];
    case "first_seen":
      return [d(artistFans.firstSeenAt)];
    case "instagram":
      return [d(artistFans.instagramInteractionsCount), desc(artistFans.superfanScore)];
    case "score":
    default:
      return [d(artistFans.superfanScore), desc(artistFans.lastActiveAt)];
  }
}

export async function listFans(artistId: string, f: FanListFilters = {}, conn: DbOrTx = defaultDb) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 25));
  const where = buildFanFilters(artistId, f);

  const rows = await conn
    .select({
      fanId: artistFans.fanId,
      firstName: fans.firstName,
      lastName: fans.lastName,
      email: fans.email,
      avatarUrl: fans.avatarUrl,
      city: fans.city,
      country: fans.country,
      superfanScore: artistFans.superfanScore,
      rewardPoints: artistFans.rewardPointsCached,
      levelId: artistFans.levelId,
      levelName: fanLevels.name,
      levelColor: fanLevels.color,
      lifetimeSpendCents: artistFans.lifetimeSpendCents,
      eventsAttendedCount: artistFans.eventsAttendedCount,
      instagramUsername: instagramUsernameExpr,
      instagramClaimed: instagramClaimedExpr,
      lastActiveAt: artistFans.lastActiveAt,
      firstSeenAt: artistFans.firstSeenAt,
      joinedAt: artistFans.joinedAt,
      hasUser: sql<boolean>`${fans.userId} is not null`,
    })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .leftJoin(fanLevels, eq(fanLevels.id, artistFans.levelId))
    .where(and(...where))
    .orderBy(...sortExpr(f.sort, f.dir ?? "desc"))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await conn
    .select({ count: sql<number>`count(*)::int` })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .where(and(...where));

  return { rows: rows as FanListRow[], total: count, page, pageSize, pages: Math.max(1, Math.ceil(count / pageSize)) };
}

/** Fast search for the command palette / search box. */
export async function searchFans(artistId: string, query: string, limit = 8, conn: DbOrTx = defaultDb) {
  const res = await listFans(artistId, { search: query, pageSize: limit, sort: "score" }, conn);
  return res.rows;
}

export async function getFanDetail(artistId: string, fanId: string, conn: DbOrTx = defaultDb) {
  const [row] = await conn
    .select({ fan: fans, membership: artistFans, level: fanLevels })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .leftJoin(fanLevels, eq(fanLevels.id, artistFans.levelId))
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)))
    .limit(1);
  if (!row) return null;

  const [identities, timeline, ledger, pointTx, notes, tags, earnedBadges, redemptions, checkins, completions, levels, refs] = await Promise.all([
    conn
      .select()
      .from(fanIdentities)
      .where(and(eq(fanIdentities.fanId, fanId), sql`(${fanIdentities.artistId} is null or ${fanIdentities.artistId} = ${artistId})`))
      .orderBy(fanIdentities.provider),
    conn
      .select()
      .from(fanEvents)
      .where(and(eq(fanEvents.artistId, artistId), eq(fanEvents.fanId, fanId)))
      .orderBy(desc(fanEvents.occurredAt))
      .limit(100),
    conn
      .select({ dimension: scoreLedger.dimension, points: sql<number>`coalesce(sum(${scoreLedger.points}), 0)::int`, entries: sql<number>`count(*)::int` })
      .from(scoreLedger)
      .where(and(eq(scoreLedger.artistId, artistId), eq(scoreLedger.fanId, fanId)))
      .groupBy(scoreLedger.dimension),
    conn
      .select()
      .from(rewardPointTransactions)
      .where(and(eq(rewardPointTransactions.artistId, artistId), eq(rewardPointTransactions.fanId, fanId)))
      .orderBy(desc(rewardPointTransactions.createdAt))
      .limit(50),
    conn
      .select({ id: fanNotes.id, body: fanNotes.body, createdAt: fanNotes.createdAt, author: users.displayName, authorEmail: users.email })
      .from(fanNotes)
      .leftJoin(users, eq(users.id, fanNotes.authorUserId))
      .where(and(eq(fanNotes.artistId, artistId), eq(fanNotes.fanId, fanId)))
      .orderBy(desc(fanNotes.createdAt)),
    conn
      .select({ id: fanTags.id, name: fanTags.name, color: fanTags.color })
      .from(fanTagAssignments)
      .innerJoin(fanTags, eq(fanTags.id, fanTagAssignments.tagId))
      .where(and(eq(fanTagAssignments.artistId, artistId), eq(fanTagAssignments.fanId, fanId))),
    conn
      .select({ badge: badges, earnedAt: fanBadges.earnedAt })
      .from(fanBadges)
      .innerJoin(badges, eq(badges.id, fanBadges.badgeId))
      .where(and(eq(fanBadges.artistId, artistId), eq(fanBadges.fanId, fanId)))
      .orderBy(desc(fanBadges.earnedAt)),
    conn
      .select({ redemption: rewardRedemptions, reward: { id: rewards.id, name: rewards.name, fulfillmentType: rewards.fulfillmentType } })
      .from(rewardRedemptions)
      .innerJoin(rewards, eq(rewards.id, rewardRedemptions.rewardId))
      .where(and(eq(rewardRedemptions.artistId, artistId), eq(rewardRedemptions.fanId, fanId)))
      .orderBy(desc(rewardRedemptions.redeemedAt)),
    conn
      .select({ checkin: eventCheckins, event: { id: artistEvents.id, name: artistEvents.name, city: artistEvents.city, startsAt: artistEvents.startsAt } })
      .from(eventCheckins)
      .innerJoin(artistEvents, eq(artistEvents.id, eventCheckins.eventId))
      .where(and(eq(eventCheckins.artistId, artistId), eq(eventCheckins.fanId, fanId)))
      .orderBy(desc(eventCheckins.checkedInAt)),
    conn
      .select({ completion: challengeCompletions, challenge: { id: challenges.id, title: challenges.title, type: challenges.type } })
      .from(challengeCompletions)
      .innerJoin(challenges, eq(challenges.id, challengeCompletions.challengeId))
      .where(and(eq(challengeCompletions.artistId, artistId), eq(challengeCompletions.fanId, fanId)))
      .orderBy(desc(challengeCompletions.completedAt)),
    conn.select().from(fanLevels).where(eq(fanLevels.artistId, artistId)).orderBy(fanLevels.sortOrder),
    referralStats(conn, artistId, fanId),
  ]);

  // Percentile within identified fans.
  const [{ above }] = await conn
    .select({ above: sql<number>`count(*)::int` })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), sql`${artistFans.superfanScore} > ${row.membership.superfanScore}`));
  const [{ total }] = await conn.select({ total: sql<number>`count(*)::int` }).from(artistFans).where(eq(artistFans.artistId, artistId));
  const topPercent = total > 0 ? Math.max(1, Math.ceil(((above + 1) / total) * 100)) : 100;

  const nextLevel = levels.find((l) => l.minScore > row.membership.superfanScore) ?? null;

  return {
    fan: row.fan,
    membership: row.membership,
    level: row.level,
    nextLevel,
    levels,
    identities,
    timeline,
    ledger,
    pointTransactions: pointTx,
    notes,
    tags,
    badges: earnedBadges,
    redemptions,
    checkins,
    completions,
    referrals: refs,
    topPercent,
    totalFans: total,
  };
}

export type FanDetail = NonNullable<Awaited<ReturnType<typeof getFanDetail>>>;

/** Distinct cities for filter dropdowns, most common first. */
export async function topCities(artistId: string, limit = 10, conn: DbOrTx = defaultDb) {
  return conn
    .select({ city: fans.city, count: sql<number>`count(*)::int` })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .where(and(eq(artistFans.artistId, artistId), sql`${fans.city} is not null and ${fans.city} <> ''`))
    .groupBy(fans.city)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

export { fanDisplayName } from "./display";
