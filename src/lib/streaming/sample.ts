import type { TopTrackStat } from "@/db/schema";

/**
 * Deterministic sample streaming data for the mock Spotify integration.
 *
 * Modeled on what Spotify for Artists reports (daily streams, rolling 28-day
 * listeners, followers, saves, top tracks) so the dashboard can be designed
 * against realistic shapes before the live sync exists. Numbers are invented.
 */

export const SAMPLE_TRACKS = [
  { title: "Nokia", weight: 0.22 },
  { title: "God's Plan", weight: 0.17 },
  { title: "One Dance", weight: 0.14 },
  { title: "What Did I Miss?", weight: 0.12 },
  { title: "Passionfruit", weight: 0.1 },
  { title: "Hotline Bling", weight: 0.09 },
  { title: "Jimmy Cooks", weight: 0.09 },
  { title: "Rich Baby Daddy", weight: 0.07 },
] as const;

/** Released 21 days before "today" and still decaying. */
export const SAMPLE_RELEASE = { title: "Dog House", daysAgo: 21 };

export type SampleDay = {
  day: string;
  streams: number;
  monthlyListeners: number;
  followers: number;
  saves: number;
  playlistAdds: number;
  topTracks: TopTrackStat[];
};

/** Small seeded PRNG so reseeding produces the same curve. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WEEKDAY_MULTIPLIER = [0.98, 0.94, 0.95, 0.97, 1.0, 1.08, 1.1]; // Sun..Sat

export function generateSampleStreamingDays(opts: { days?: number; endsAt?: Date; seed?: number } = {}): SampleDay[] {
  const days = opts.days ?? 120;
  const end = opts.endsAt ?? new Date();
  const rand = mulberry32(opts.seed ?? 20260921);
  const out: SampleDay[] = [];
  let followers = 94_500_000;

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i));
    const t = -i; // days relative to today (0 = today)
    const growth = 1 + (0.12 * (days - 1 - i)) / (days - 1);
    const weekday = WEEKDAY_MULTIPLIER[d.getUTCDay()];
    const release = t >= -SAMPLE_RELEASE.daysAgo ? 1 + 1.35 * Math.exp(-(t + SAMPLE_RELEASE.daysAgo) / 6) : 1;
    const playlist = t >= -63 ? 1 + 0.3 * Math.exp(-(t + 63) / 12) : 1;
    const noise = 0.94 + rand() * 0.12;
    const streams = Math.round(27_000_000 * growth * weekday * release * playlist * noise);

    const releaseBoost = t >= -SAMPLE_RELEASE.daysAgo ? 0.16 * (0.55 + 0.45 * Math.exp(-(t + SAMPLE_RELEASE.daysAgo) / 14)) : 0;
    const topTracks: TopTrackStat[] = SAMPLE_TRACKS.map((tr) => ({
      title: tr.title,
      streams: Math.round(streams * tr.weight * (1 - releaseBoost) * (0.92 + rand() * 0.16)),
    }));
    if (releaseBoost > 0) topTracks.push({ title: SAMPLE_RELEASE.title, streams: Math.round(streams * releaseBoost) });
    topTracks.sort((a, b) => b.streams - a.streams);

    followers += Math.round(9_000 + rand() * 5_000 + (release - 1) * 180_000 + (playlist - 1) * 40_000);
    const monthlyListeners = Math.round(streams * 2.9 * (0.97 + rand() * 0.06));

    out.push({
      day: d.toISOString().slice(0, 10),
      streams,
      monthlyListeners,
      followers,
      saves: Math.round(streams * 0.017 * (0.9 + rand() * 0.2)),
      playlistAdds: Math.round(streams * 0.0035 * (0.9 + rand() * 0.2)),
      topTracks,
    });
  }
  return out;
}

/** Weighted pick of a favourite track for a sample fan. */
export function pickSampleTrack(random = Math.random): string {
  let r = random();
  for (const t of SAMPLE_TRACKS) {
    r -= t.weight;
    if (r <= 0) return t.title;
  }
  return SAMPLE_TRACKS[0].title;
}
