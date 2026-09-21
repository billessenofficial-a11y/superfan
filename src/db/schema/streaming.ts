import { boolean, date, index, integer, jsonb, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { artists } from "./core";
import { integrationProviderEnum } from "./enums";

export type TopTrackStat = { title: string; streams: number };

/**
 * Artist-level streaming metrics, one row per provider per day. Populated by
 * a provider sync (Spotify for Artists once available) or by the sample
 * generator while the integration runs in mock mode. Fan-level listening is
 * NOT stored here; it flows through fan_events like every other signal.
 */
export const streamingDaily = pgTable(
  "streaming_daily",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull().default("spotify"),
    day: date("day").notNull(),
    streams: integer("streams").notNull().default(0),
    /** Provider's rolling 28-day unique listeners as reported on that day. */
    monthlyListeners: integer("monthly_listeners").notNull().default(0),
    /** Follower count at end of day. */
    followers: integer("followers").notNull().default(0),
    saves: integer("saves").notNull().default(0),
    playlistAdds: integer("playlist_adds").notNull().default(0),
    topTracks: jsonb("top_tracks").$type<TopTrackStat[]>().notNull().default([]),
    /** True for generated sample data (mock integration). */
    isSample: boolean("is_sample").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("streaming_daily_artist_provider_day_idx").on(t.artistId, t.provider, t.day), index("streaming_daily_artist_day_idx").on(t.artistId, t.day)],
);
