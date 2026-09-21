import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { artists, users } from "./core";
import { pointTransactionTypeEnum, scoreDimensionEnum } from "./enums";
import { fanEvents } from "./events";
import { fans } from "./fans";

/**
 * Per-artist scoring rules. Seeded with the default rule set when an artist
 * is created; editable in Settings → Scoring.
 */
export const scoreRules = pgTable(
  "score_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    /** Stable key, e.g. "merch.first_purchase". */
    key: text("key").notNull(),
    label: text("label").notNull(),
    category: text("category").notNull(),
    dimension: scoreDimensionEnum("dimension").notNull(),
    points: integer("points").notNull(),
    /** For per-unit rules (e.g. "each $1 spent"): points are multiplied by the unit count. */
    perUnit: boolean("per_unit").default(false).notNull(),
    /** Cap on total points from this rule within `cap_window`. Null = no cap. */
    capPoints: integer("cap_points"),
    /** "day" | "week" | "month" | "lifetime" */
    capWindow: text("cap_window"),
    enabled: boolean("enabled").default(true).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("score_rules_artist_key_idx").on(t.artistId, t.key)],
);

/**
 * Append-only score ledger. Superfan Score = SUM(points) (weighted by
 * dimension). Every row is attributable to an event, a rule and/or a reason.
 */
export const scoreLedger = pgTable(
  "score_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    eventId: uuid("event_id").references(() => fanEvents.id, { onDelete: "set null" }),
    ruleId: uuid("rule_id").references(() => scoreRules.id, { onDelete: "set null" }),
    ruleKey: text("rule_key"),
    dimension: scoreDimensionEnum("dimension").notNull(),
    points: integer("points").notNull(),
    reason: text("reason").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("score_ledger_artist_fan_idx").on(t.artistId, t.fanId),
    index("score_ledger_event_idx").on(t.eventId),
    index("score_ledger_rule_window_idx").on(t.artistId, t.fanId, t.ruleKey, t.occurredAt),
  ],
);

/** Daily score snapshots for trend charts. */
export const scoreSnapshots = pgTable(
  "score_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    score: integer("score").notNull(),
    levelId: uuid("level_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("score_snapshots_artist_fan_date_idx").on(t.artistId, t.fanId, t.snapshotDate),
  ],
);

/**
 * Immutable reward point ledger. Balance = SUM(amount).
 * `artist_fans.reward_points_cached` is always derived from this table.
 */
export const rewardPointTransactions = pgTable(
  "reward_point_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    transactionType: pointTransactionTypeEnum("transaction_type").notNull(),
    /** Id of the originating entity (event, challenge completion, redemption...). */
    sourceId: text("source_id"),
    description: text("description").notNull(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reward_point_tx_artist_fan_idx").on(t.artistId, t.fanId, t.createdAt),
    uniqueIndex("reward_point_tx_source_idx")
      .on(t.artistId, t.transactionType, t.sourceId)
      .where(sql`${t.sourceId} is not null and ${t.transactionType} <> 'MANUAL_ADJUSTMENT'`),
  ],
);

/** Fan levels / tiers, configurable per artist. */
export const fanLevels = pgTable(
  "fan_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minScore: integer("min_score").notNull(),
    sortOrder: integer("sort_order").notNull(),
    color: text("color").default("#a78bfa").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("fan_levels_artist_sort_idx").on(t.artistId, t.sortOrder),
    index("fan_levels_artist_min_idx").on(t.artistId, t.minScore),
  ],
);
