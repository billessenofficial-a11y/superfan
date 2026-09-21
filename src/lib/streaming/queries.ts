import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/db";
import { artistFans, fanEvents, fanIdentities, fanLevels, fans, integrations, streamingDaily, type TopTrackStat } from "@/db/schema";
import { EVENT_TYPES } from "@/lib/events/types";
import { generateSampleStreamingDays } from "./sample";

const DAY = 86_400_000;
const WINDOW = 28;

function growth(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

function sum<T>(rows: T[], pick: (r: T) => number) {
  return rows.reduce((s, r) => s + pick(r), 0);
}

export type StreamingSeriesPoint = { date: string; streams: number; listeners: number };
export type TopTrack = { title: string; streams: number; share: number; growth: number | null };
export type ListeningFan = {
  fanId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  plays: number;
  topTrack: string | null;
  score: number;
  levelName: string | null;
  levelColor: string | null;
};

export type StreamingOverview = {
  provider: "spotify";
  isSample: boolean;
  connected: boolean;
  lastUpdated: string;
  window: number;
  streams: { value: number; growth: number | null };
  monthlyListeners: { value: number; growth: number | null };
  followers: { value: number; growth: number | null; delta: number };
  saves: { value: number; growth: number | null };
  series: StreamingSeriesPoint[];
  topTracks: TopTrack[];
  fans: { linked: number; identified: number; active: number; plays: number; top: ListeningFan[] };
};

/**
 * Everything the Streaming page and the Overview card need. Returns null when
 * the artist has no streaming data at all (integration never connected).
 */
export async function getStreamingOverview(artistId: string, conn: DbOrTx = defaultDb): Promise<StreamingOverview | null> {
  const since = new Date(Date.now() - 120 * DAY);
  const rows = await conn
    .select()
    .from(streamingDaily)
    .where(and(eq(streamingDaily.artistId, artistId), eq(streamingDaily.provider, "spotify"), gte(streamingDaily.day, since.toISOString().slice(0, 10))))
    .orderBy(streamingDaily.day);
  if (rows.length === 0) return null;

  const [integration] = await conn
    .select({ status: integrations.status })
    .from(integrations)
    .where(and(eq(integrations.artistId, artistId), eq(integrations.provider, "spotify")))
    .limit(1);

  const latest = rows[rows.length - 1];
  const current = rows.slice(-WINDOW);
  const previous = rows.slice(-WINDOW * 2, -WINDOW);
  const followersBefore = previous.length ? previous[previous.length - 1].followers : (rows[0]?.followers ?? 0);

  const trackTotals = new Map<string, number>();
  const trackPrev = new Map<string, number>();
  for (const r of current) for (const t of r.topTracks as TopTrackStat[]) trackTotals.set(t.title, (trackTotals.get(t.title) ?? 0) + t.streams);
  for (const r of previous) for (const t of r.topTracks as TopTrackStat[]) trackPrev.set(t.title, (trackPrev.get(t.title) ?? 0) + t.streams);
  const streamsNow = sum(current, (r) => r.streams);
  const topTracks: TopTrack[] = [...trackTotals.entries()]
    .map(([title, streams]) => ({ title, streams, share: streamsNow > 0 ? (streams / streamsNow) * 100 : 0, growth: growth(streams, trackPrev.get(title) ?? 0) }))
    .sort((a, b) => b.streams - a.streams)
    .slice(0, 8);

  // Fan-level listening (weekly roll-up events) in the same window.
  const windowStart = new Date(Date.now() - WINDOW * DAY);
  const [fanTotals] = await conn
    .select({
      active: sql<number>`count(distinct ${fanEvents.fanId})::int`,
      plays: sql<number>`coalesce(sum((${fanEvents.metadata}->>'plays')::int), 0)::int`,
    })
    .from(fanEvents)
    .where(and(eq(fanEvents.artistId, artistId), eq(fanEvents.type, EVENT_TYPES.spotifyStream), gte(fanEvents.occurredAt, windowStart)));

  // Spotify identities are global (not artist-scoped), so count them through the artist's fan roster.
  const [linked] = await conn
    .select({ count: sql<number>`count(distinct ${fanIdentities.fanId})::int` })
    .from(fanIdentities)
    .innerJoin(artistFans, and(eq(artistFans.fanId, fanIdentities.fanId), eq(artistFans.artistId, artistId)))
    .where(eq(fanIdentities.provider, "spotify"));

  const [identified] = await conn.select({ count: sql<number>`count(*)::int` }).from(artistFans).where(eq(artistFans.artistId, artistId));

  const topFanRows = await conn
    .select({
      fanId: fanEvents.fanId,
      plays: sql<number>`coalesce(sum((${fanEvents.metadata}->>'plays')::int), 0)::int`,
      topTrack: sql<string | null>`(array_agg(${fanEvents.metadata}->>'topTrack' order by ${fanEvents.occurredAt} desc))[1]`,
    })
    .from(fanEvents)
    .where(and(eq(fanEvents.artistId, artistId), eq(fanEvents.type, EVENT_TYPES.spotifyStream), gte(fanEvents.occurredAt, windowStart), sql`${fanEvents.fanId} is not null`))
    .groupBy(fanEvents.fanId)
    .orderBy(desc(sql`sum((${fanEvents.metadata}->>'plays')::int)`))
    .limit(6);

  let top: ListeningFan[] = [];
  if (topFanRows.length) {
    const ids = topFanRows.map((r) => r.fanId!) as string[];
    const details = await conn
      .select({
        fanId: fans.id,
        firstName: fans.firstName,
        lastName: fans.lastName,
        email: fans.email,
        avatarUrl: fans.avatarUrl,
        score: artistFans.superfanScore,
        levelName: fanLevels.name,
        levelColor: fanLevels.color,
      })
      .from(artistFans)
      .innerJoin(fans, eq(fans.id, artistFans.fanId))
      .leftJoin(fanLevels, eq(fanLevels.id, artistFans.levelId))
      .where(and(eq(artistFans.artistId, artistId), sql`${artistFans.fanId} in ${ids}`));
    const byId = new Map(details.map((d) => [d.fanId, d]));
    top = topFanRows
      .map((r) => {
        const d = byId.get(r.fanId!);
        return d ? { ...d, plays: r.plays, topTrack: r.topTrack } : null;
      })
      .filter((x): x is ListeningFan => x !== null);
  }

  return {
    provider: "spotify",
    isSample: latest.isSample,
    connected: integration?.status === "connected",
    lastUpdated: latest.day,
    window: WINDOW,
    streams: { value: streamsNow, growth: growth(streamsNow, sum(previous, (r) => r.streams)) },
    monthlyListeners: { value: latest.monthlyListeners, growth: growth(latest.monthlyListeners, previous.length ? previous[previous.length - 1].monthlyListeners : 0) },
    followers: { value: latest.followers, growth: growth(latest.followers, followersBefore), delta: latest.followers - followersBefore },
    saves: { value: sum(current, (r) => r.saves), growth: growth(sum(current, (r) => r.saves), sum(previous, (r) => r.saves)) },
    series: rows.slice(-90).map((r) => ({ date: r.day, streams: r.streams, listeners: r.monthlyListeners })),
    topTracks,
    fans: { linked: linked.count, identified: identified.count, active: fanTotals.active, plays: fanTotals.plays, top },
  };
}

/** Insert the deterministic sample series for an artist (idempotent). */
export async function seedSampleStreaming(artistId: string, conn: DbOrTx = defaultDb, opts: { days?: number } = {}) {
  const days = generateSampleStreamingDays({ days: opts.days ?? 120 });
  await conn
    .insert(streamingDaily)
    .values(days.map((d) => ({ artistId, provider: "spotify" as const, day: d.day, streams: d.streams, monthlyListeners: d.monthlyListeners, followers: d.followers, saves: d.saves, playlistAdds: d.playlistAdds, topTracks: d.topTracks, isSample: true })))
    .onConflictDoNothing();
  return days.length;
}

/** Add streams to today's row (used by the demo event generator). */
export async function bumpStreamingToday(artistId: string, input: { streams: number; track?: string; saves?: number }, conn: DbOrTx = defaultDb) {
  const today = new Date().toISOString().slice(0, 10);
  const [existing] = await conn
    .select()
    .from(streamingDaily)
    .where(and(eq(streamingDaily.artistId, artistId), eq(streamingDaily.provider, "spotify"), eq(streamingDaily.day, today)))
    .limit(1);
  const tracks: TopTrackStat[] = [...((existing?.topTracks as TopTrackStat[] | undefined) ?? [])];
  if (input.track) {
    const t = tracks.find((x) => x.title === input.track);
    if (t) t.streams += input.streams;
    else tracks.push({ title: input.track, streams: input.streams });
    tracks.sort((a, b) => b.streams - a.streams);
  }
  if (existing) {
    await conn
      .update(streamingDaily)
      .set({ streams: existing.streams + input.streams, saves: existing.saves + (input.saves ?? 0), topTracks: tracks, updatedAt: new Date() })
      .where(eq(streamingDaily.id, existing.id));
    return existing.streams + input.streams;
  }
  const [prev] = await conn
    .select()
    .from(streamingDaily)
    .where(and(eq(streamingDaily.artistId, artistId), eq(streamingDaily.provider, "spotify")))
    .orderBy(desc(streamingDaily.day))
    .limit(1);
  await conn.insert(streamingDaily).values({
    artistId,
    provider: "spotify",
    day: today,
    streams: input.streams,
    monthlyListeners: prev?.monthlyListeners ?? 0,
    followers: prev?.followers ?? 0,
    saves: input.saves ?? 0,
    playlistAdds: 0,
    topTracks: tracks,
    isSample: prev?.isSample ?? true,
  });
  return input.streams;
}
