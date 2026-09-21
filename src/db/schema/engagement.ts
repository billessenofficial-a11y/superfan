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
import {
  artistEventStatusEnum,
  badgeRarityEnum,
  challengeStatusEnum,
  challengeTypeEnum,
  fulfillmentTypeEnum,
  redemptionStatusEnum,
  referralStatusEnum,
  rewardStatusEnum,
  verificationEnum,
} from "./enums";
import { fans } from "./fans";

/* ───────────────────────── Badges ───────────────────────── */

export type BadgeCriteria =
  | { kind: "events_attended"; count: number }
  | { kind: "lifetime_spend_cents"; amount: number }
  | { kind: "referrals"; count: number }
  | { kind: "member_before"; date: string }
  | { kind: "challenge_completed"; challengeId: string }
  | { kind: "level_reached"; levelSortOrder: number }
  | { kind: "manual" };

export const badges = pgTable(
  "badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Null = system badge available to every artist. */
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    icon: text("icon").notNull().default("award"),
    rarity: badgeRarityEnum("rarity").notNull().default("common"),
    criteria: jsonb("criteria").$type<BadgeCriteria>().notNull().default({ kind: "manual" }),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("badges_artist_key_idx").on(
      sql`coalesce(${t.artistId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
      t.key,
    ),
  ],
);

export const fanBadges = pgTable(
  "fan_badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    badgeId: uuid("badge_id")
      .notNull()
      .references(() => badges.id, { onDelete: "cascade" }),
    earnedAt: timestamp("earned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("fan_badges_artist_fan_badge_idx").on(t.artistId, t.fanId, t.badgeId),
    index("fan_badges_artist_badge_idx").on(t.artistId, t.badgeId),
  ],
);

/* ───────────────────────── Challenges ───────────────────────── */

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
};

export type ChallengeConfig = {
  /** quiz */
  questions?: QuizQuestion[];
  passScore?: number;
  /** promo_code */
  code?: string;
  /** link_visit */
  url?: string;
  /** form_submission */
  fields?: { key: string; label: string; type: "text" | "textarea" | "select"; options?: string[]; required?: boolean }[];
  /** event_checkin */
  eventId?: string;
  /** purchase */
  minimumAmountCents?: number;
  /** referral */
  referralsRequired?: number;
};

export const challenges = pgTable(
  "challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    type: challengeTypeEnum("type").notNull().default("manual"),
    status: challengeStatusEnum("status").notNull().default("draft"),
    /** Reward points awarded on completion. */
    points: integer("points").notNull().default(100),
    /** Whether this counts as a "major" challenge for Superfan Score purposes. */
    isMajor: boolean("is_major").default(false).notNull(),
    imageUrl: text("image_url"),
    config: jsonb("config").$type<ChallengeConfig>().notNull().default({}),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    maxCompletions: integer("max_completions"),
    campaignId: uuid("campaign_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("challenges_artist_status_idx").on(t.artistId, t.status)],
);

export const challengeCompletions = pgTable(
  "challenge_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    challengeId: uuid("challenge_id")
      .notNull()
      .references(() => challenges.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    submission: jsonb("submission").$type<Record<string, unknown>>().notNull().default({}),
    pointsAwarded: integer("points_awarded").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("challenge_completions_challenge_fan_idx").on(t.challengeId, t.fanId),
    index("challenge_completions_artist_fan_idx").on(t.artistId, t.fanId),
  ],
);

/* ───────────────────────── Rewards ───────────────────────── */

export const rewards = pgTable(
  "rewards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    imageUrl: text("image_url"),
    pointCost: integer("point_cost").notNull(),
    /** Null = unlimited. */
    inventory: integer("inventory"),
    redeemedCount: integer("redeemed_count").default(0).notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    minimumLevelId: uuid("minimum_level_id"),
    minimumScore: integer("minimum_score"),
    /** Optional city/country restriction, e.g. "Los Angeles". */
    locationRestriction: text("location_restriction"),
    fulfillmentType: fulfillmentTypeEnum("fulfillment_type").notNull().default("digital"),
    status: rewardStatusEnum("status").notNull().default("draft"),
    maxPerFan: integer("max_per_fan").default(1).notNull(),
    campaignId: uuid("campaign_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("rewards_artist_status_idx").on(t.artistId, t.status)],
);

export const rewardRedemptions = pgTable(
  "reward_redemptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    rewardId: uuid("reward_id")
      .notNull()
      .references(() => rewards.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    pointsSpent: integer("points_spent").notNull(),
    status: redemptionStatusEnum("status").notNull().default("pending"),
    fulfillmentNote: text("fulfillment_note"),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reward_redemptions_artist_fan_idx").on(t.artistId, t.fanId),
    index("reward_redemptions_reward_idx").on(t.rewardId),
  ],
);

/* ───────────────────────── Concerts / events ───────────────────────── */

export const artistEvents = pgTable(
  "artist_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    venue: text("venue"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    imageUrl: text("image_url"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    status: artistEventStatusEnum("status").notNull().default("upcoming"),
    /** Check-in window. Outside of it, the QR code is rejected. */
    checkinOpensAt: timestamp("checkin_opens_at", { withTimezone: true }),
    checkinClosesAt: timestamp("checkin_closes_at", { withTimezone: true }),
    checkinPoints: integer("checkin_points").notNull().default(500),
    /** Rotating secret embedded in the signed QR token; rotate to invalidate old codes. */
    checkinSecret: text("checkin_secret").notNull(),
    checkinSecretRotatedAt: timestamp("checkin_secret_rotated_at", { withTimezone: true }).defaultNow().notNull(),
    requiresStaffVerification: boolean("requires_staff_verification").default(false).notNull(),
    ticketmasterEventId: text("ticketmaster_event_id"),
    capacity: integer("capacity"),
    checkinsCount: integer("checkins_count").default(0).notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("artist_events_artist_starts_idx").on(t.artistId, t.startsAt)],
);

export const eventCheckins = pgTable(
  "event_checkins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => artistEvents.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    verification: verificationEnum("verification").notNull().default("verified"),
    method: text("method").notNull().default("qr"),
    verifiedByUserId: uuid("verified_by_user_id").references(() => users.id, { onDelete: "set null" }),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("event_checkins_event_fan_idx").on(t.eventId, t.fanId),
    index("event_checkins_artist_fan_idx").on(t.artistId, t.fanId),
  ],
);

/* ───────────────────────── Referrals ───────────────────────── */

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    referrerFanId: uuid("referrer_fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    referredFanId: uuid("referred_fan_id")
      .notNull()
      .references(() => fans.id, { onDelete: "cascade" }),
    status: referralStatusEnum("status").notNull().default("pending"),
    referralCode: text("referral_code").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
  },
  (t) => [
    /** A given fan can only ever be referred once per artist. */
    uniqueIndex("referrals_artist_referred_idx").on(t.artistId, t.referredFanId),
    index("referrals_artist_referrer_idx").on(t.artistId, t.referrerFanId),
  ],
);
