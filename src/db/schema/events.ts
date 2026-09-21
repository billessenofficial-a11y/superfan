import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { artists } from "./core";
import {
  eventSourceEnum,
  integrationProviderEnum,
  verificationEnum,
  webhookStatusEnum,
} from "./enums";
import { fanIdentities, fans } from "./fans";

/**
 * Normalized fan events. Every integration writes here through the event
 * ingestion service and nowhere else. Uniqueness on
 * (artist_id, source, source_event_id) guarantees idempotency.
 */
export const fanEvents = pgTable(
  "fan_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artistId: uuid("artist_id")
      .notNull()
      .references(() => artists.id, { onDelete: "cascade" }),
    fanId: uuid("fan_id").references(() => fans.id, { onDelete: "set null" }),
    identityId: uuid("identity_id").references(() => fanIdentities.id, { onDelete: "set null" }),
    source: eventSourceEnum("source").notNull(),
    type: text("type").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    verification: verificationEnum("verification").notNull().default("verified"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    /** Human-friendly summary for activity feeds, e.g. "Purchased Tour Hoodie". */
    summary: text("summary"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("fan_events_idempotency_idx").on(t.artistId, t.source, t.sourceEventId),
    index("fan_events_artist_idx").on(t.artistId, t.occurredAt),
    index("fan_events_fan_idx").on(t.fanId, t.occurredAt),
    index("fan_events_type_idx").on(t.artistId, t.type),
    index("fan_events_source_idx").on(t.artistId, t.source),
    index("fan_events_identity_idx").on(t.identityId),
  ],
);

/**
 * Raw inbound webhooks. Stored before any processing so retries and
 * failures can be audited. Payloads are pruned by retention jobs.
 */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: integrationProviderEnum("provider").notNull(),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "set null" }),
    externalEventId: text("external_event_id"),
    topic: text("topic"),
    payload: jsonb("payload").$type<unknown>().notNull(),
    headers: jsonb("headers").$type<Record<string, string>>().notNull().default({}),
    status: webhookStatusEnum("status").notNull().default("received"),
    attempts: integer("attempts").default(0).notNull(),
    error: text("error"),
    producedEventCount: integer("produced_event_count").default(0).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("webhook_events_provider_external_idx")
      .on(t.provider, t.externalEventId)
      .where(sql`${t.externalEventId} is not null`),
    index("webhook_events_status_idx").on(t.status, t.receivedAt),
    index("webhook_events_artist_idx").on(t.artistId, t.receivedAt),
  ],
);
