import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/db";
import { artistFans, fanEvents, fanLevels, fans } from "@/db/schema";

const DAY = 86_400_000;

function growth(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

export async function getOverviewMetrics(artistId: string, conn: DbOrTx = defaultDb) {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);

  const [superfanLevel] = await conn
    .select({ minScore: fanLevels.minScore })
    .from(fanLevels)
    .where(and(eq(fanLevels.artistId, artistId), sql`lower(${fanLevels.name}) in ('superfan','gold','platinum')`))
    .orderBy(fanLevels.sortOrder)
    .limit(1);
  const superfanThreshold = superfanLevel?.minScore ?? 3500;

  const [totals] = await conn
    .select({
      identified: sql<number>`count(*)::int`,
      identifiedBefore30: sql<number>`count(*) filter (where ${artistFans.firstSeenAt} < ${d30.toISOString()}::timestamptz)::int`,
      superfans: sql<number>`count(*) filter (where ${artistFans.superfanScore} >= ${superfanThreshold})::int`,
      active30: sql<number>`count(*) filter (where ${artistFans.lastActiveAt} >= ${d30.toISOString()}::timestamptz)::int`,
      activePrev30: sql<number>`count(*) filter (where ${artistFans.lastActiveAt} >= ${d60.toISOString()}::timestamptz and ${artistFans.lastActiveAt} < ${d30.toISOString()}::timestamptz)::int`,
      revenueCents: sql<number>`coalesce(sum(${artistFans.lifetimeSpendCents}), 0)::bigint`,
      joined: sql<number>`count(*) filter (where ${artistFans.joinedAt} is not null)::int`,
    })
    .from(artistFans)
    .where(eq(artistFans.artistId, artistId));

  const [revenue] = await conn
    .select({
      last30: sql<number>`coalesce(sum((${fanEvents.metadata}->>'amountCents')::bigint) filter (where ${fanEvents.occurredAt} >= ${d30.toISOString()}::timestamptz), 0)::bigint`,
      prev30: sql<number>`coalesce(sum((${fanEvents.metadata}->>'amountCents')::bigint) filter (where ${fanEvents.occurredAt} >= ${d60.toISOString()}::timestamptz and ${fanEvents.occurredAt} < ${d30.toISOString()}::timestamptz), 0)::bigint`,
    })
    .from(fanEvents)
    .where(and(eq(fanEvents.artistId, artistId), inArray(fanEvents.type, ["shopify.order.created", "csv.merch_purchase"])));

  // Superfans 30 days ago ≈ fans whose score crossed the threshold before then.
  const [superfansBefore] = await conn
    .select({ count: sql<number>`count(distinct ${fanEvents.fanId})::int` })
    .from(fanEvents)
    .where(and(eq(fanEvents.artistId, artistId), eq(fanEvents.type, "fan.level_reached"), sql`(${fanEvents.metadata}->>'score')::int >= ${superfanThreshold}`, sql`${fanEvents.occurredAt} < ${d30.toISOString()}::timestamptz`));

  return {
    identified: { value: totals.identified, growth: growth(totals.identified, totals.identifiedBefore30) },
    superfans: { value: totals.superfans, growth: growth(totals.superfans, superfansBefore.count) },
    active30: { value: totals.active30, growth: growth(totals.active30, totals.activePrev30) },
    revenue: { valueCents: Number(totals.revenueCents), growth: growth(Number(revenue.last30), Number(revenue.prev30)), last30Cents: Number(revenue.last30) },
    joined: totals.joined,
    superfanThreshold,
  };
}

/** Cumulative identified fans per day for the last N days. */
export async function getFanGrowthSeries(artistId: string, days = 30, conn: DbOrTx = defaultDb) {
  const start = new Date(Date.now() - days * DAY);
  start.setUTCHours(0, 0, 0, 0);
  const [{ base }] = await conn
    .select({ base: sql<number>`count(*)::int` })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), sql`${artistFans.firstSeenAt} < ${start.toISOString()}::timestamptz`));
  const perDay = await conn
    .select({ day: sql<string>`to_char(date_trunc('day', ${artistFans.firstSeenAt}), 'YYYY-MM-DD')`, count: sql<number>`count(*)::int` })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), gte(artistFans.firstSeenAt, start)))
    .groupBy(sql`date_trunc('day', ${artistFans.firstSeenAt})`);
  const map = new Map(perDay.map((r) => [r.day, r.count]));
  const out: { date: string; fans: number; newFans: number }[] = [];
  let running = base;
  for (let i = 0; i <= days; i++) {
    const d = new Date(start.getTime() + i * DAY);
    const key = d.toISOString().slice(0, 10);
    const added = map.get(key) ?? 0;
    running += added;
    out.push({ date: key, fans: running, newFans: added });
  }
  return out;
}

const SOURCE_LABELS: Record<string, string> = { instagram: "Instagram", shopify: "Shopify", superfan: "Superfan", csv: "Imports", spotify: "Spotify", tiktok: "TikTok", ticketmaster: "Ticketmaster", manual: "Manual" };

/** Share of engagement by source over the last 30 days, grouped the way the PRD lists them. */
export async function getEngagementSources(artistId: string, conn: DbOrTx = defaultDb) {
  const d30 = new Date(Date.now() - 30 * DAY);
  const rows = await conn
    .select({ source: fanEvents.source, type: fanEvents.type, count: sql<number>`count(*)::int` })
    .from(fanEvents)
    .where(and(eq(fanEvents.artistId, artistId), gte(fanEvents.occurredAt, d30), sql`${fanEvents.type} not in ('fan.level_reached','fan.badge_earned')`))
    .groupBy(fanEvents.source, fanEvents.type);
  const buckets = new Map<string, number>();
  for (const r of rows) {
    let label = SOURCE_LABELS[r.source] ?? r.source;
    if (r.type.startsWith("event.") || r.type.startsWith("manual.attendance")) label = "Events";
    else if (r.type.startsWith("fan.referral")) label = "Referrals";
    else if (r.type.startsWith("challenge.")) label = "Challenges";
    else if (r.type.startsWith("reward.")) label = "Rewards";
    else if (r.type === "csv.merch_purchase") label = "Shopify";
    else if (r.type === "csv.ticket_purchase") label = "Events";
    buckets.set(label, (buckets.get(label) ?? 0) + r.count);
  }
  const total = [...buckets.values()].reduce((s, n) => s + n, 0);
  return [...buckets.entries()]
    .map(([label, count]) => ({ label, count, share: total > 0 ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}

export async function getLevelDistribution(artistId: string, conn: DbOrTx = defaultDb) {
  const levels = await conn.select().from(fanLevels).where(eq(fanLevels.artistId, artistId)).orderBy(fanLevels.sortOrder);
  const counts = await conn
    .select({ levelId: artistFans.levelId, count: sql<number>`count(*)::int` })
    .from(artistFans)
    .where(eq(artistFans.artistId, artistId))
    .groupBy(artistFans.levelId);
  const map = new Map(counts.map((c) => [c.levelId, c.count]));
  return levels.map((l) => ({ id: l.id, name: l.name, color: l.color, minScore: l.minScore, count: map.get(l.id) ?? 0 }));
}

export async function getTopCities(artistId: string, limit = 5, conn: DbOrTx = defaultDb) {
  const rows = await conn
    .select({
      city: fans.city,
      country: fans.country,
      fans: sql<number>`count(*)::int`,
      engaged: sql<number>`count(*) filter (where ${artistFans.superfanScore} >= 1500)::int`,
      attended: sql<number>`count(*) filter (where ${artistFans.eventsAttendedCount} > 0)::int`,
      spenders: sql<number>`count(*) filter (where ${artistFans.lifetimeSpendCents} > 15000)::int`,
    })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .where(and(eq(artistFans.artistId, artistId), sql`${fans.city} is not null and ${fans.city} <> ''`))
    .groupBy(fans.city, fans.country)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows;
}

/** Recently active top-tier fans with their latest action. */
export async function getRecentSuperfans(artistId: string, limit = 6, conn: DbOrTx = defaultDb) {
  const rows = await conn
    .select({
      fanId: artistFans.fanId,
      firstName: fans.firstName,
      lastName: fans.lastName,
      avatarUrl: fans.avatarUrl,
      city: fans.city,
      score: artistFans.superfanScore,
      levelName: fanLevels.name,
      levelColor: fanLevels.color,
      lastActiveAt: artistFans.lastActiveAt,
      latest: sql<string | null>`(select fe.summary from fan_events fe where fe.fan_id = ${artistFans.fanId} and fe.artist_id = ${artistFans.artistId} and fe.type not in ('fan.level_reached','fan.badge_earned') order by fe.occurred_at desc limit 1)`,
    })
    .from(artistFans)
    .innerJoin(fans, eq(fans.id, artistFans.fanId))
    .leftJoin(fanLevels, eq(fanLevels.id, artistFans.levelId))
    .where(and(eq(artistFans.artistId, artistId), sql`${artistFans.superfanScore} >= 3500`))
    .orderBy(desc(artistFans.lastActiveAt))
    .limit(limit);
  return rows;
}

export type ActivityFilters = { type?: string; source?: string; fanId?: string; page?: number; pageSize?: number; since?: Date };

/** Activity stream with fan names; used by Overview and the Activity page. */
export async function listActivity(artistId: string, f: ActivityFilters = {}, conn: DbOrTx = defaultDb) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, f.pageSize ?? 30));
  const where = [eq(fanEvents.artistId, artistId)];
  if (f.type) where.push(f.type.endsWith(".") ? sql`${fanEvents.type} like ${f.type + "%"}` : eq(fanEvents.type, f.type));
  if (f.source) where.push(sql`${fanEvents.source} = ${f.source}::event_source`);
  if (f.fanId) where.push(eq(fanEvents.fanId, f.fanId));
  if (f.since) where.push(gte(fanEvents.occurredAt, f.since));

  const rows = await conn
    .select({
      event: fanEvents,
      fan: { id: fans.id, firstName: fans.firstName, lastName: fans.lastName, avatarUrl: fans.avatarUrl, city: fans.city },
      levelName: fanLevels.name,
      levelColor: fanLevels.color,
      score: artistFans.superfanScore,
    })
    .from(fanEvents)
    .leftJoin(fans, eq(fans.id, fanEvents.fanId))
    .leftJoin(artistFans, and(eq(artistFans.fanId, fanEvents.fanId), eq(artistFans.artistId, fanEvents.artistId)))
    .leftJoin(fanLevels, eq(fanLevels.id, artistFans.levelId))
    .where(and(...where))
    .orderBy(desc(fanEvents.occurredAt), desc(fanEvents.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  const [{ count }] = await conn.select({ count: sql<number>`count(*)::int` }).from(fanEvents).where(and(...where));
  return { rows, total: count, page, pageSize, pages: Math.max(1, Math.ceil(count / pageSize)) };
}

export async function getEventTypeCounts(artistId: string, conn: DbOrTx = defaultDb) {
  return conn
    .select({ type: fanEvents.type, source: fanEvents.source, count: sql<number>`count(*)::int` })
    .from(fanEvents)
    .where(eq(fanEvents.artistId, artistId))
    .groupBy(fanEvents.type, fanEvents.source)
    .orderBy(desc(sql`count(*)`));
}
