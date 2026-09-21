import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb, type DbOrTx, type Database } from "@/db";
import { artistFans, artists, fanEvents } from "@/db/schema";
import { deterministicId } from "@/lib/crypto";
import { resolveActor } from "@/lib/identity/resolver";
import { evaluateBadges, type Badge } from "@/lib/badges/evaluate";
import { awardPoints } from "@/lib/points/ledger";
import { POINTS_PER_DOLLAR_DEFAULT, SIGNUP_BONUS_POINTS } from "@/lib/scoring/defaults";
import { loadRules, recomputeFanScore, scoreEvent, type LedgerEntry } from "@/lib/scoring/engine";
import { EVENT_TYPES, fanEventInputSchema, type FanEventInput } from "./types";

export type IngestResult = {
  status: "created" | "duplicate";
  eventId: string;
  fanId: string | null;
  identityId: string | null;
  ledger: LedgerEntry[];
  scoreDelta: number;
  score: number;
  pointsAwarded: number;
  levelUp: boolean;
  levelName: string | null;
  newBadges: Badge[];
  fanCreated: boolean;
  artistFanCreated: boolean;
};

type EventRow = typeof fanEvents.$inferSelect;

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function isTransaction(x: DbOrTx): boolean {
  return !("transaction" in x) || typeof (x as Database).transaction !== "function";
}

/**
 * The single entry point for every activity in Superfan.
 *
 *   Provider → Adapter → FanEvent → [ingestEvent] → identity → score → profile
 *
 * Guarantees:
 *  - idempotent on (artistId, source, sourceEventId)
 *  - the fan_events row, ledger rows and cached aggregates are written in one
 *    transaction
 *  - unknown event types are stored but not scored
 */
export async function ingestEvent(rawInput: FanEventInput, conn: DbOrTx = defaultDb): Promise<IngestResult> {
  const input = fanEventInputSchema.parse(rawInput);
  const occurredAt = input.occurredAt ?? new Date();
  const sourceEventId =
    input.sourceEventId ??
    deterministicId([
      input.source,
      input.type,
      input.identity ? `${input.identity.provider}:${input.identity.externalUserId}` : null,
      input.email ?? null,
      input.phone ?? null,
      input.fanId ?? null,
      occurredAt.toISOString(),
      typeof input.metadata.objectId === "string" ? input.metadata.objectId : null,
    ]);

  const run = async (tx: DbOrTx): Promise<IngestResult> => {
    // 1. Idempotent insert. A duplicate webhook delivery short-circuits here.
    const [inserted] = await tx
      .insert(fanEvents)
      .values({
        artistId: input.artistId,
        source: input.source,
        type: input.type,
        sourceEventId,
        occurredAt,
        verification: input.verification,
        metadata: input.metadata,
        summary: input.summary ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!inserted) {
      const [existing] = await tx
        .select()
        .from(fanEvents)
        .where(
          and(
            eq(fanEvents.artistId, input.artistId),
            eq(fanEvents.source, input.source),
            eq(fanEvents.sourceEventId, sourceEventId),
          ),
        )
        .limit(1);
      return duplicate(existing);
    }

    // 2. Resolve who did this. Follow-up events (refunds, cancellations) may
    //    only reference the original event; borrow its fan.
    let fanIdHint = input.fanId;
    const originalRef = typeof input.metadata.originalSourceEventId === "string" ? input.metadata.originalSourceEventId : null;
    if (!fanIdHint && !input.email && !input.phone && !input.identity && originalRef) {
      const [original] = await tx
        .select({ fanId: fanEvents.fanId })
        .from(fanEvents)
        .where(and(eq(fanEvents.artistId, input.artistId), eq(fanEvents.source, input.source), eq(fanEvents.sourceEventId, originalRef)))
        .limit(1);
      fanIdHint = original?.fanId ?? undefined;
    }
    if (!fanIdHint && !input.email && !input.phone && !input.identity) {
      // Nothing to attribute this to. Keep the raw event for auditing, unscored.
      return { ...duplicate(inserted), status: "created" };
    }

    const actor = await resolveActor(tx, {
      artistId: input.artistId,
      fanId: fanIdHint,
      email: input.email,
      phone: input.phone,
      identity: input.identity,
      profile: input.profile,
      source: input.source,
      occurredAt,
    });

    // Serialize processing per artist-fan so caps and counters stay consistent.
    await tx
      .select({ id: artistFans.id })
      .from(artistFans)
      .where(and(eq(artistFans.artistId, input.artistId), eq(artistFans.fanId, actor.fanId)))
      .for("update");

    const [event] = await tx
      .update(fanEvents)
      .set({ fanId: actor.fanId, identityId: actor.identityId })
      .where(eq(fanEvents.id, inserted.id))
      .returning();

    // 3. Score.
    const rules = await loadRules(tx, input.artistId);
    const ledger = await scoreEvent(tx, rules, {
      id: event.id,
      artistId: event.artistId,
      fanId: actor.fanId,
      type: event.type,
      source: event.source,
      sourceEventId: event.sourceEventId,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
    });

    // 4. Aggregates on the read model.
    await applyAggregates(tx, event, actor.fanId);

    // 5. Reward points for deliberate, artist-controlled actions.
    const pointsAwarded = await awardEventPoints(tx, event, actor.fanId);

    // 6. Recompute cached score & level, then badges.
    const recompute = await recomputeFanScore(tx, input.artistId, actor.fanId);
    if (recompute.levelUp && recompute.level) {
      await tx
        .insert(fanEvents)
        .values({
          artistId: input.artistId,
          fanId: actor.fanId,
          source: "superfan",
          type: EVENT_TYPES.fanLevelReached,
          sourceEventId: `level:${actor.fanId}:${recompute.level.id}`,
          occurredAt: new Date(Math.max(occurredAt.getTime(), Date.now() - 1000)),
          verification: "verified",
          metadata: { levelId: recompute.level.id, levelName: recompute.level.name, score: recompute.score },
          summary: `Reached ${recompute.level.name} level`,
        })
        .onConflictDoNothing();
    }

    const newBadges = await evaluateBadges(tx, input.artistId, actor.fanId);
    for (const badge of newBadges) {
      await tx
        .insert(fanEvents)
        .values({
          artistId: input.artistId,
          fanId: actor.fanId,
          source: "superfan",
          type: EVENT_TYPES.fanBadgeEarned,
          sourceEventId: `badge:${actor.fanId}:${badge.id}`,
          occurredAt: new Date(),
          verification: "verified",
          metadata: { badgeId: badge.id, badgeKey: badge.key, badgeName: badge.name },
          summary: `Earned the "${badge.name}" badge`,
        })
        .onConflictDoNothing();
    }

    return {
      status: "created",
      eventId: event.id,
      fanId: actor.fanId,
      identityId: actor.identityId,
      ledger,
      scoreDelta: recompute.score - recompute.previousScore,
      score: recompute.score,
      pointsAwarded,
      levelUp: recompute.levelUp,
      levelName: recompute.level?.name ?? null,
      newBadges,
      fanCreated: actor.fanCreated,
      artistFanCreated: actor.artistFanCreated,
    };
  };

  if (isTransaction(conn)) return run(conn);
  return (conn as Database).transaction(run);
}

function duplicate(existing: EventRow): IngestResult {
  return {
    status: "duplicate",
    eventId: existing.id,
    fanId: existing.fanId,
    identityId: existing.identityId,
    ledger: [],
    scoreDelta: 0,
    score: 0,
    pointsAwarded: 0,
    levelUp: false,
    levelName: null,
    newBadges: [],
    fanCreated: false,
    artistFanCreated: false,
  };
}

async function applyAggregates(tx: DbOrTx, event: EventRow, fanId: string) {
  const m = event.metadata;
  const at = event.occurredAt.toISOString();
  const set: Record<string, unknown> = {
    lastActiveAt: sql`greatest(coalesce(${artistFans.lastActiveAt}, 'epoch'::timestamptz), ${at}::timestamptz)`,
    firstSeenAt: sql`least(${artistFans.firstSeenAt}, ${at}::timestamptz)`,
  };

  switch (event.type) {
    case EVENT_TYPES.shopifyOrderCreated:
    case EVENT_TYPES.csvMerchPurchase:
      set.lifetimeSpendCents = sql`${artistFans.lifetimeSpendCents} + ${Math.round(num(m.amountCents))}`;
      set.ordersCount = sql`${artistFans.ordersCount} + ${Math.max(1, Math.round(num(m.ordersCount, 1)))}`;
      break;
    case EVENT_TYPES.shopifyOrderRefunded:
      set.lifetimeSpendCents = sql`greatest(0, ${artistFans.lifetimeSpendCents} - ${Math.round(num(m.refundedCents))})`;
      break;
    case EVENT_TYPES.eventCheckedIn:
    case EVENT_TYPES.eventAttendanceImported:
    case EVENT_TYPES.manualAttendanceVerified:
      set.eventsAttendedCount = sql`${artistFans.eventsAttendedCount} + 1`;
      break;
    case EVENT_TYPES.fanReferralCompleted:
      set.referralsCount = sql`${artistFans.referralsCount} + 1`;
      break;
    case EVENT_TYPES.instagramComment:
    case EVENT_TYPES.instagramDm:
    case EVENT_TYPES.instagramMention:
      set.instagramInteractionsCount = sql`${artistFans.instagramInteractionsCount} + 1`;
      break;
    case EVENT_TYPES.challengeCompleted:
      set.challengesCompletedCount = sql`${artistFans.challengesCompletedCount} + 1`;
      break;
    case EVENT_TYPES.fanJoined:
    case EVENT_TYPES.fanSignup:
      set.joinedAt = sql`coalesce(${artistFans.joinedAt}, ${at}::timestamptz)`;
      break;
  }

  await tx
    .update(artistFans)
    .set(set)
    .where(and(eq(artistFans.artistId, event.artistId), eq(artistFans.fanId, fanId)));
}

/**
 * Reward points that are awarded automatically by the ingestion pipeline.
 * Check-ins, challenges and referrals award their points in their own flows
 * (they carry more context); purchases and signups are handled here.
 */
async function awardEventPoints(tx: DbOrTx, event: EventRow, fanId: string): Promise<number> {
  switch (event.type) {
    case EVENT_TYPES.shopifyOrderCreated:
    case EVENT_TYPES.csvMerchPurchase: {
      const [artist] = await tx
        .select({ settings: artists.settings })
        .from(artists)
        .where(eq(artists.id, event.artistId))
        .limit(1);
      const perDollar = num(artist?.settings?.pointsPerDollar, POINTS_PER_DOLLAR_DEFAULT);
      const dollars = Math.floor(num(event.metadata.amountCents) / 100);
      const amount = Math.floor(dollars * perDollar);
      if (amount <= 0) return 0;
      const res = await awardPoints(tx, {
        artistId: event.artistId,
        fanId,
        amount,
        type: "PURCHASE",
        sourceId: event.id,
        description: event.summary ?? "Merch purchase",
      });
      return res.applied ? amount : 0;
    }
    case EVENT_TYPES.fanJoined: {
      const res = await awardPoints(tx, {
        artistId: event.artistId,
        fanId,
        amount: SIGNUP_BONUS_POINTS,
        type: "SIGNUP",
        sourceId: `join:${fanId}`,
        description: "Welcome bonus",
      });
      return res.applied ? SIGNUP_BONUS_POINTS : 0;
    }
    default:
      return 0;
  }
}

/** Ingest a batch sequentially (webhooks may carry several entries). */
export async function ingestEvents(inputs: FanEventInput[], conn: DbOrTx = defaultDb): Promise<IngestResult[]> {
  const out: IngestResult[] = [];
  for (const input of inputs) out.push(await ingestEvent(input, conn));
  return out;
}
