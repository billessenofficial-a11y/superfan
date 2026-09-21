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
  claimTokenStatusEnum,
  identityProviderEnum,
  integrationProviderEnum,
  integrationStatusEnum,
} from "./enums";
import { fanIdentities, fans } from "./fans";

/* ───────────────────────── Integrations ───────────────────────── */

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    status: integrationStatusEnum("status").notNull().default("disconnected"),
    /** e.g. Instagram business account id, Shopify shop domain. */
    externalAccountId: text("external_account_id"),
    /** e.g. "@lumavale", "luma-store.myshopify.com". */
    externalAccountName: text("external_account_name"),
    /** Encrypted with SUPERFAN_ENCRYPTION_KEY. Never returned to the client. */
    accessTokenEncrypted: text("access_token_encrypted"),
    refreshTokenEncrypted: text("refresh_token_encrypted"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    settings: jsonb("settings").$type<Record<string, unknown>>().notNull().default({}),
    /** True when the integration is backed by the mock adapter (demo). */
    isMock: boolean("is_mock").default(false).notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    lastError: text("last_error"),
    connectedByUserId: uuid("connected_by_user_id").references(() => users.id, { onDelete: "set null" }),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("integrations_artist_provider_idx").on(t.artistId, t.provider)],
);

/** Short-lived OAuth state for provider connect flows. */
export const oauthStates = pgTable(
  "oauth_states",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    provider: integrationProviderEnum("provider").notNull(),
    state: text("state").notNull(),
    codeVerifier: text("code_verifier"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("oauth_states_state_idx").on(t.state)],
);

/* ───────────────────────── Claim tokens ───────────────────────── */

/**
 * Signed, single-use tokens that let a fan attach an external identity
 * (e.g. Instagram commenter) to their canonical fan account. The token
 * itself is never stored; only its hash.
 */
export const claimTokens = pgTable(
  "claim_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => fanIdentities.id, { onDelete: "cascade" }),
    provider: identityProviderEnum("provider").notNull(),
    tokenHash: text("token_hash").notNull(),
    status: claimTokenStatusEnum("status").notNull().default("active"),
    claimedByFanId: uuid("claimed_by_fan_id").references(() => fans.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("claim_tokens_hash_idx").on(t.tokenHash),
    index("claim_tokens_identity_idx").on(t.identityId),
  ],
);

/* ───────────────────────── Audit log ───────────────────────── */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("audit_logs_artist_idx").on(t.artistId, t.createdAt)],
);

/* ───────────────────────── Product analytics ───────────────────────── */

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    fanId: uuid("fan_id").references(() => fans.id, { onDelete: "set null" }),
    properties: jsonb("properties").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("analytics_events_name_idx").on(t.name, t.createdAt)],
);

/* ───────────────────────── Local dev auth ───────────────────────── */

/**
 * Magic-link tokens for the local development auth provider (used only when
 * Supabase is not configured). Hash only.
 */
export const authMagicLinks = pgTable(
  "auth_magic_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    redirectTo: text("redirect_to"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("auth_magic_links_hash_idx").on(t.tokenHash)],
);

/** Simple fixed-window rate limit buckets for public endpoints. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(0),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  },
);
