import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { artists, users } from "./core";
import {
  campaignStatusEnum,
  campaignTypeEnum,
  importRowStatusEnum,
  importStatusEnum,
} from "./enums";
import { fans } from "./fans";

/* ───────────────────────── Segments ───────────────────────── */

export type SegmentOperator =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "not_contains"
  | "is_known"
  | "is_unknown";

export type SegmentCondition = {
  kind: "condition";
  field: string;
  operator: SegmentOperator;
  value?: string | number | boolean | null;
};

export type SegmentGroup = {
  kind: "group";
  match: "all" | "any";
  children: SegmentNode[];
};

export type SegmentNode = SegmentCondition | SegmentGroup;

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    rules: jsonb("rules").$type<SegmentGroup>().notNull(),
    /** Cached count from the last evaluation. */
    cachedCount: integer("cached_count"),
    cachedAt: timestamp("cached_at", { withTimezone: true }),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("segments_artist_idx").on(t.artistId)],
);

/* ───────────────────────── Campaigns ───────────────────────── */

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    type: campaignTypeEnum("type").notNull(),
    status: campaignStatusEnum("status").notNull().default("draft"),
    segmentId: uuid("segment_id").references(() => segments.id, { onDelete: "set null" }),
    minimumScore: integer("minimum_score"),
    minimumLevelId: uuid("minimum_level_id"),
    capacity: integer("capacity"),
    participantsCount: integer("participants_count").default(0).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    /** Linked entity depending on type. */
    challengeId: uuid("challenge_id"),
    rewardId: uuid("reward_id"),
    eventId: uuid("event_id"),
    /** Promo code / survey questions / instructions. */
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("campaigns_artist_status_idx").on(t.artistId, t.status)],
);

export const campaignParticipants = pgTable(
  "campaign_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    response: jsonb("response").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("campaign_participants_campaign_fan_idx").on(t.campaignId, t.fanId)],
);

/* ───────────────────────── CSV imports ───────────────────────── */

export type ImportColumnMapping = Record<string, string | null>;

export const imports = pgTable(
  "imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    /** Human label such as "2025 tour ticket buyers". */
    sourceLabel: text("source_label"),
    status: importStatusEnum("status").notNull().default("pending"),
    /** csv column → superfan field (email, first_name, order_total, ...) */
    mapping: jsonb("mapping").$type<ImportColumnMapping>().notNull().default({}),
    headers: jsonb("headers").$type<string[]>().notNull().default([]),
    rowCount: integer("row_count").default(0).notNull(),
    processedCount: integer("processed_count").default(0).notNull(),
    importedCount: integer("imported_count").default(0).notNull(),
    skippedCount: integer("skipped_count").default(0).notNull(),
    errorCount: integer("error_count").default(0).notNull(),
    error: text("error"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("imports_artist_idx").on(t.artistId, t.createdAt)],
);

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importId: uuid("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(),
    raw: jsonb("raw").$type<Record<string, string>>().notNull(),
    status: importRowStatusEnum("status").notNull().default("pending"),
    fanId: uuid("fan_id").references(() => fans.id, { onDelete: "set null" }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("import_rows_import_idx").on(t.importId, t.rowNumber)],
);
