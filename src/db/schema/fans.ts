import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { artists, users } from "./core";
import { eventSourceEnum, identityProviderEnum } from "./enums";

/**
 * Canonical fan. One row per real person, across all artists.
 * `user_id` is set once the fan has authenticated (claimed their passport).
 */
export const fans = pgTable(
  "fans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    phone: text("phone"),
    phoneVerifiedAt: timestamp("phone_verified_at", { withTimezone: true }),
    firstName: text("first_name"),
    lastName: text("last_name"),
    avatarUrl: text("avatar_url"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    timezone: text("timezone"),
    consentedAt: timestamp("consented_at", { withTimezone: true }),
    privacyPolicyVersion: text("privacy_policy_version"),
    communicationPreferences: jsonb("communication_preferences")
      .$type<{ email: boolean; sms: boolean }>()
      .notNull()
      .default({ email: true, sms: false }),
    /** Set when the fan is merged into another fan. Queries should follow this. */
    mergedIntoFanId: uuid("merged_into_fan_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("fans_email_idx")
      .on(sql`lower(${t.email})`)
      .where(sql`${t.email} is not null and ${t.mergedIntoFanId} is null`),
    uniqueIndex("fans_phone_idx")
      .on(t.phone)
      .where(sql`${t.phone} is not null and ${t.mergedIntoFanId} is null`),
    index("fans_user_idx").on(t.userId),
    index("fans_name_idx").on(t.lastName, t.firstName),
  ],
);

export type DimensionScores = {
  commerce: number;
  attendance: number;
  engagement: number;
  advocacy: number;
  community: number;
  recency: number;
};

/**
 * A fan's relationship with one artist. Holds cached aggregates that are
 * always derivable from the ledgers and event tables.
 */
export const artistFans = pgTable(
  "artist_fans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),

    superfanScore: integer("superfan_score").default(0).notNull(),
    /** Raw per-dimension ledger sums (before weighting). */
    dimensionRaw: jsonb("dimension_raw").$type<Omit<DimensionScores, "recency">>().notNull().default({
      commerce: 0,
      attendance: 0,
      engagement: 0,
      advocacy: 0,
      community: 0,
    }),
    /** Normalized 0–100 per-dimension sub-scores. */
    dimensionScores: jsonb("dimension_scores").$type<DimensionScores>().notNull().default({
      commerce: 0,
      attendance: 0,
      engagement: 0,
      advocacy: 0,
      community: 0,
      recency: 0,
    }),
    rewardPointsCached: integer("reward_points_cached").default(0).notNull(),
    levelId: uuid("level_id"),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).defaultNow().notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true }),

    lifetimeSpendCents: integer("lifetime_spend_cents").default(0).notNull(),
    ordersCount: integer("orders_count").default(0).notNull(),
    eventsAttendedCount: integer("events_attended_count").default(0).notNull(),
    referralsCount: integer("referrals_count").default(0).notNull(),
    instagramInteractionsCount: integer("instagram_interactions_count").default(0).notNull(),
    challengesCompletedCount: integer("challenges_completed_count").default(0).notNull(),

    referralCode: text("referral_code").notNull(),
    firstSource: eventSourceEnum("first_source"),
    isBlocked: boolean("is_blocked").default(false).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("artist_fans_artist_fan_idx").on(t.artistId, t.fanId),
    uniqueIndex("artist_fans_referral_code_idx").on(t.artistId, t.referralCode),
    index("artist_fans_artist_score_idx").on(t.artistId, t.superfanScore),
    index("artist_fans_artist_last_active_idx").on(t.artistId, t.lastActiveAt),
    index("artist_fans_artist_level_idx").on(t.artistId, t.levelId),
    index("artist_fans_fan_idx").on(t.fanId),
  ],
);

/**
 * External identities. May exist before a canonical fan is known
 * (e.g. an Instagram commenter who has not claimed their passport yet).
 */
export const fanIdentities = pgTable(
  "fan_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fanId: uuid("fan_id").references(() => fans.id, { onDelete: "set null" }),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "cascade" }),
    provider: identityProviderEnum("provider").notNull(),
    externalUserId: text("external_user_id").notNull(),
    username: text("username"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    claimed: boolean("claimed").default(false).notNull(),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    verified: boolean("verified").default(false).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("fan_identities_provider_external_artist_idx").on(
      t.provider,
      t.externalUserId,
      sql`coalesce(${t.artistId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
    ),
    index("fan_identities_fan_idx").on(t.fanId),
    index("fan_identities_artist_idx").on(t.artistId),
    index("fan_identities_username_idx").on(t.provider, sql`lower(${t.username})`),
  ],
);

export const fanNotes = pgTable(
  "fan_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    authorUserId: uuid("author_user_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("fan_notes_artist_fan_idx").on(t.artistId, t.fanId)],
);

export const fanTags = pgTable(
  "fan_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#a78bfa").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("fan_tags_artist_name_idx").on(t.artistId, sql`lower(${t.name})`)],
);

export const fanTagAssignments = pgTable(
  "fan_tag_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => fanTags.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("fan_tag_assignments_tag_fan_idx").on(t.tagId, t.fanId),
    index("fan_tag_assignments_artist_fan_idx").on(t.artistId, t.fanId),
  ],
);
