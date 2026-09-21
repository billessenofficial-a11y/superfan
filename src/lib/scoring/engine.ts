import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import {
  artistFans,
  artists,
  badges,
  fanEvents,
  fanLevels,
  scoreLedger,
  scoreRules,
  type ScoreDimensionWeights,
} from "@/db/schema";
import { EVENT_TYPES } from "@/lib/events/types";
import {
  DEFAULT_BADGES,
  DEFAULT_LEVELS,
  DEFAULT_SCORE_RULES,
  DEFAULT_TARGETS,
  DEFAULT_WEIGHTS,
  DIMENSIONS,
  type CapWindow,
  type ScoreDimension,
} from "./defaults";

export type ScoreRule = typeof scoreRules.$inferSelect;
export type LedgerEntry = typeof scoreLedger.$inferSelect;

/* ───────────────────────── Setup ───────────────────────── */

export async function ensureDefaultRules(tx: DbOrTx, artistId: string) {
  await tx
    .insert(scoreRules)
    .values(
      DEFAULT_SCORE_RULES.map((r, i) => ({
        artistId,
        key: r.key,
        label: r.label,
        category: r.category,
        dimension: r.dimension,
        points: r.points,
        perUnit: r.perUnit ?? false,
        capPoints: r.capPoints ?? null,
        capWindow: r.capWindow ?? null,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing();
}

export async function ensureDefaultLevels(tx: DbOrTx, artistId: string) {
  const existing = await tx
    .select({ id: fanLevels.id })
    .from(fanLevels)
    .where(eq(fanLevels.artistId, artistId))
    .limit(1);
  if (existing.length > 0) return;
  await tx.insert(fanLevels).values(
    DEFAULT_LEVELS.map((l, i) => ({
      artistId,
      name: l.name,
      minScore: l.minScore,
      sortOrder: i,
      color: l.color,
    })),
  );
}

export async function ensureSystemBadges(tx: DbOrTx) {
  await tx
    .insert(badges)
    .values(
      DEFAULT_BADGES.map((b, i) => ({
        artistId: null,
        key: b.key,
        name: b.name,
        description: b.description,
        icon: b.icon,
        rarity: b.rarity,
        criteria: b.criteria,
        sortOrder: i,
      })),
    )
    .onConflictDoNothing();
}

/* ───────────────────────── Rules ───────────────────────── */

export async function loadRules(tx: DbOrTx, artistId: string): Promise<Map<string, ScoreRule>> {
  const rows = await tx.select().from(scoreRules).where(eq(scoreRules.artistId, artistId));
  return new Map(rows.map((r) => [r.key, r]));
}

function windowStart(window: CapWindow, at: Date): Date | null {
  const d = new Date(at);
  switch (window) {
    case "day":
      d.setUTCDate(d.getUTCDate() - 1);
      return d;
    case "week":
      d.setUTCDate(d.getUTCDate() - 7);
      return d;
    case "month":
      d.setUTCMonth(d.getUTCMonth() - 1);
      return d;
    case "lifetime":
      return null;
  }
}

async function pointsUsedInWindow(
  tx: DbOrTx,
  artistId: string,
  fanId: string,
  ruleKey: string,
  window: CapWindow,
  at: Date,
): Promise<number> {
  const start = windowStart(window, at);
  const conditions = [
    eq(scoreLedger.artistId, artistId),
    eq(scoreLedger.fanId, fanId),
    eq(scoreLedger.ruleKey, ruleKey),
    lte(scoreLedger.occurredAt, at),
  ];
  if (start) conditions.push(gte(scoreLedger.occurredAt, start));
  const [row] = await tx
    .select({ total: sql<number>`coalesce(sum(${scoreLedger.points}), 0)::int` })
    .from(scoreLedger)
    .where(and(...conditions));
  return row?.total ?? 0;
}

async function hasLedgerForRule(tx: DbOrTx, artistId: string, fanId: string, ruleKeys: string[]) {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(scoreLedger)
    .where(
      and(
        eq(scoreLedger.artistId, artistId),
        eq(scoreLedger.fanId, fanId),
        inArray(scoreLedger.ruleKey, ruleKeys),
        sql`${scoreLedger.points} > 0`,
      ),
    );
  return row?.count ?? 0;
}

export type ApplyRuleInput = {
  artistId: string;
  fanId: string;
  ruleKey: string;
  eventId?: string | null;
  occurredAt: Date;
  units?: number;
  reason?: string;
  actorUserId?: string | null;
};

/**
 * Apply one rule for a fan and append the resulting ledger row (if any).
 * Respects per-rule caps. Returns the points actually credited.
 */
export async function applyRule(
  tx: DbOrTx,
  rules: Map<string, ScoreRule>,
  input: ApplyRuleInput,
): Promise<LedgerEntry | null> {
  const rule = rules.get(input.ruleKey);
  if (!rule || !rule.enabled) return null;

  let points = rule.perUnit ? rule.points * Math.max(0, Math.floor(input.units ?? 0)) : rule.points;
  if (points === 0) return null;

  if (rule.capPoints != null && rule.capWindow) {
    const used = await pointsUsedInWindow(
      tx,
      input.artistId,
      input.fanId,
      rule.key,
      rule.capWindow as CapWindow,
      input.occurredAt,
    );
    const remaining = Math.max(0, rule.capPoints - used);
    points = Math.min(points, remaining);
    if (points <= 0) return null;
  }

  const [entry] = await tx
    .insert(scoreLedger)
    .values({
      artistId: input.artistId,
      fanId: input.fanId,
      eventId: input.eventId ?? null,
      ruleId: rule.id,
      ruleKey: rule.key,
      dimension: rule.dimension,
      points,
      reason: input.reason ?? rule.label,
      actorUserId: input.actorUserId ?? null,
      occurredAt: input.occurredAt,
    })
    .returning();
  return entry;
}

/** Append a manual adjustment (audited by the caller). */
export async function applyManualAdjustment(
  tx: DbOrTx,
  input: {
    artistId: string;
    fanId: string;
    dimension: ScoreDimension;
    points: number;
    reason: string;
    actorUserId: string | null;
    eventId?: string | null;
  },
): Promise<LedgerEntry> {
  const [entry] = await tx
    .insert(scoreLedger)
    .values({
      artistId: input.artistId,
      fanId: input.fanId,
      eventId: input.eventId ?? null,
      ruleKey: "manual.adjustment",
      dimension: input.dimension,
      points: input.points,
      reason: input.reason,
      actorUserId: input.actorUserId,
      occurredAt: new Date(),
    })
    .returning();
  return entry;
}

/* ───────────────────────── Event → rules mapping ───────────────────────── */

export type ScoreableEvent = {
  id: string;
  artistId: string;
  fanId: string;
  type: string;
  source: string;
  sourceEventId: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
};

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Translate a normalized event into ledger entries using the artist's rules.
 * Counts (first purchase, Nth concert...) are derived from the ledger itself
 * so re-scoring after a claim/merge stays consistent and order-independent.
 */
export async function scoreEvent(
  tx: DbOrTx,
  rules: Map<string, ScoreRule>,
  event: ScoreableEvent,
): Promise<LedgerEntry[]> {
  const entries: LedgerEntry[] = [];
  const base = { artistId: event.artistId, fanId: event.fanId, eventId: event.id, occurredAt: event.occurredAt };
  const push = (e: LedgerEntry | null) => {
    if (e) entries.push(e);
  };
  const m = event.metadata;

  switch (event.type) {
    case EVENT_TYPES.shopifyOrderCreated:
    case EVENT_TYPES.csvMerchPurchase: {
      const amountCents = num(m.amountCents);
      const ordersInRow = Math.max(1, num(m.ordersCount, 1));
      const priorPurchases = await hasLedgerForRule(tx, event.artistId, event.fanId, [
        "merch.first_purchase",
      ]);
      if (priorPurchases === 0) {
        push(await applyRule(tx, rules, { ...base, ruleKey: "merch.first_purchase" }));
        if (ordersInRow > 1) {
          push(
            await applyRule(tx, rules, {
              ...base,
              ruleKey: "merch.repeat_purchase",
              reason: `Repeat purchases (${ordersInRow - 1})`,
              units: ordersInRow - 1,
            }),
          );
        }
      } else {
        push(await applyRule(tx, rules, { ...base, ruleKey: "merch.repeat_purchase" }));
      }
      push(
        await applyRule(tx, rules, {
          ...base,
          ruleKey: "merch.per_dollar",
          units: amountCents / 100,
          reason: `$${(amountCents / 100).toFixed(2)} spent`,
        }),
      );
      break;
    }

    case EVENT_TYPES.shopifyOrderRefunded: {
      // Reverse the score attributed to the original order, proportionally
      // for partial refunds.
      const originalSourceEventId = typeof m.originalSourceEventId === "string" ? m.originalSourceEventId : null;
      if (!originalSourceEventId) break;
      const [original] = await tx
        .select({ id: fanEvents.id, metadata: fanEvents.metadata })
        .from(fanEvents)
        .where(
          and(
            eq(fanEvents.artistId, event.artistId),
            eq(fanEvents.source, "shopify"),
            eq(fanEvents.sourceEventId, originalSourceEventId),
          ),
        )
        .limit(1);
      if (!original) break;
      const originalAmount = num(original.metadata.amountCents);
      const refundedCents = num(m.refundedCents, originalAmount);
      const fullRefund = originalAmount === 0 || refundedCents >= originalAmount;
      const originalEntries = await tx
        .select()
        .from(scoreLedger)
        .where(and(eq(scoreLedger.eventId, original.id), sql`${scoreLedger.points} > 0`));
      for (const entry of originalEntries) {
        let reversal = entry.points;
        if (!fullRefund) {
          if (entry.ruleKey !== "merch.per_dollar") continue;
          reversal = Math.min(entry.points, Math.floor((refundedCents / 100) * 2));
        }
        if (reversal <= 0) continue;
        const [row] = await tx
          .insert(scoreLedger)
          .values({
            artistId: event.artistId,
            fanId: event.fanId,
            eventId: event.id,
            ruleId: entry.ruleId,
            ruleKey: entry.ruleKey,
            dimension: entry.dimension,
            points: -reversal,
            reason: fullRefund ? "Order refunded" : "Partial refund",
            occurredAt: event.occurredAt,
          })
          .returning();
        push(row);
      }
      break;
    }

    case EVENT_TYPES.csvTicketPurchase: {
      push(await applyRule(tx, rules, { ...base, ruleKey: "concert.ticket_purchase" }));
      break;
    }

    case EVENT_TYPES.eventCheckedIn:
    case EVENT_TYPES.eventAttendanceImported:
    case EVENT_TYPES.manualAttendanceVerified: {
      const prior = await hasLedgerForRule(tx, event.artistId, event.fanId, [
        "concert.attendance",
        "concert.second",
        "concert.third_plus",
      ]);
      const ruleKey = prior === 0 ? "concert.attendance" : prior === 1 ? "concert.second" : "concert.third_plus";
      const eventName = typeof m.eventName === "string" ? m.eventName : undefined;
      push(
        await applyRule(tx, rules, {
          ...base,
          ruleKey,
          reason: eventName ? `Attended ${eventName}` : undefined,
        }),
      );
      break;
    }

    case EVENT_TYPES.instagramComment: {
      const text = typeof m.text === "string" ? m.text.trim() : "";
      if (text.length < 2) break; // ignore empty / single-character noise
      const prior = await hasLedgerForRule(tx, event.artistId, event.fanId, ["instagram.first_comment"]);
      if (prior === 0) {
        push(await applyRule(tx, rules, { ...base, ruleKey: "instagram.first_comment" }));
      } else {
        push(await applyRule(tx, rules, { ...base, ruleKey: "instagram.comment" }));
      }
      break;
    }
    case EVENT_TYPES.instagramDm:
      push(await applyRule(tx, rules, { ...base, ruleKey: "instagram.dm" }));
      break;
    case EVENT_TYPES.instagramMention:
      push(await applyRule(tx, rules, { ...base, ruleKey: "instagram.mention" }));
      break;

    case EVENT_TYPES.fanReferralCompleted:
      push(await applyRule(tx, rules, { ...base, ruleKey: "referral.successful" }));
      break;

    case EVENT_TYPES.challengeCompleted: {
      const major = m.isMajor === true;
      const title = typeof m.challengeTitle === "string" ? m.challengeTitle : undefined;
      push(
        await applyRule(tx, rules, {
          ...base,
          ruleKey: major ? "challenge.major" : "challenge.normal",
          reason: title ? `Completed "${title}"` : undefined,
        }),
      );
      break;
    }

    case EVENT_TYPES.fanSignup:
      push(await applyRule(tx, rules, { ...base, ruleKey: "community.signup" }));
      break;
    case EVENT_TYPES.fanJoined: {
      const prior = await hasLedgerForRule(tx, event.artistId, event.fanId, ["community.join"]);
      if (prior === 0) push(await applyRule(tx, rules, { ...base, ruleKey: "community.join" }));
      break;
    }

    case EVENT_TYPES.spotifyArtistTop:
      push(await applyRule(tx, rules, { ...base, ruleKey: "spotify.artist_top" }));
      break;
    case EVENT_TYPES.spotifyRecentPlay:
      push(await applyRule(tx, rules, { ...base, ruleKey: "spotify.recent_play" }));
      break;
    case EVENT_TYPES.tiktokConnected:
      push(await applyRule(tx, rules, { ...base, ruleKey: "tiktok.connected" }));
      break;

    case EVENT_TYPES.manualScoreAdjustment: {
      const dimension = (DIMENSIONS as string[]).includes(String(m.dimension))
        ? (m.dimension as ScoreDimension)
        : "community";
      const points = Math.trunc(num(m.points));
      if (points !== 0) {
        push(
          await applyManualAdjustment(tx, {
            artistId: event.artistId,
            fanId: event.fanId,
            dimension,
            points,
            reason: typeof m.reason === "string" ? m.reason : "Manual adjustment",
            actorUserId: typeof m.actorUserId === "string" ? m.actorUserId : null,
            eventId: event.id,
          }),
        );
      }
      break;
    }

    default:
      // Unknown or informational event types are stored but not scored.
      break;
  }

  return entries;
}

/* ───────────────────────── Recompute ───────────────────────── */

export type DimensionRaw = Record<ScoreDimension, number>;

export function computeWeightedScore(
  raw: DimensionRaw,
  weights: ScoreDimensionWeights = DEFAULT_WEIGHTS,
): number {
  let total = 0;
  for (const d of DIMENSIONS) {
    const multiplier = (weights[d] ?? DEFAULT_WEIGHTS[d]) / DEFAULT_WEIGHTS[d];
    total += (raw[d] ?? 0) * multiplier;
  }
  return Math.max(0, Math.round(total));
}

export function computeDimensionScores(
  raw: DimensionRaw,
  targets: ScoreDimensionWeights = DEFAULT_TARGETS,
): Record<ScoreDimension, number> {
  const out = {} as Record<ScoreDimension, number>;
  for (const d of DIMENSIONS) {
    const target = targets[d] ?? DEFAULT_TARGETS[d];
    out[d] = Math.max(0, Math.min(100, Math.round((100 * (raw[d] ?? 0)) / Math.max(1, target))));
  }
  return out;
}

export function computeRecency(lastActiveAt: Date | null, now = new Date()): number {
  if (!lastActiveAt) return 0;
  const days = (now.getTime() - lastActiveAt.getTime()) / 86_400_000;
  if (days <= 7) return 100;
  if (days >= 90) return 0;
  return Math.round(100 - ((days - 7) / 83) * 100);
}

export type RecomputeResult = {
  score: number;
  previousScore: number;
  levelId: string | null;
  previousLevelId: string | null;
  levelUp: boolean;
  level: { id: string; name: string; sortOrder: number } | null;
};

/**
 * Recompute a fan's cached score, sub-scores and level from the ledger.
 * The artist_fans row is the read model; the ledger is the source of truth.
 */
export async function recomputeFanScore(
  tx: DbOrTx,
  artistId: string,
  fanId: string,
): Promise<RecomputeResult> {
  const [artist] = await tx
    .select({ weights: artists.scoreWeights, targets: artists.scoreTargets })
    .from(artists)
    .where(eq(artists.id, artistId))
    .limit(1);

  const sums = await tx
    .select({
      dimension: scoreLedger.dimension,
      total: sql<number>`coalesce(sum(${scoreLedger.points}), 0)::int`,
    })
    .from(scoreLedger)
    .where(and(eq(scoreLedger.artistId, artistId), eq(scoreLedger.fanId, fanId)))
    .groupBy(scoreLedger.dimension);

  const raw: DimensionRaw = { commerce: 0, attendance: 0, engagement: 0, advocacy: 0, community: 0 };
  for (const s of sums) {
    if (s.dimension in raw) raw[s.dimension as ScoreDimension] = s.total;
  }

  const score = computeWeightedScore(raw, artist?.weights ?? DEFAULT_WEIGHTS);
  const dims = computeDimensionScores(raw, artist?.targets ?? DEFAULT_TARGETS);

  const [current] = await tx
    .select({
      superfanScore: artistFans.superfanScore,
      levelId: artistFans.levelId,
      lastActiveAt: artistFans.lastActiveAt,
    })
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)))
    .limit(1);

  const [level] = await tx
    .select({ id: fanLevels.id, name: fanLevels.name, sortOrder: fanLevels.sortOrder })
    .from(fanLevels)
    .where(and(eq(fanLevels.artistId, artistId), lte(fanLevels.minScore, score)))
    .orderBy(desc(fanLevels.minScore))
    .limit(1);

  let previousSort = -1;
  if (current?.levelId) {
    const [prev] = await tx
      .select({ sortOrder: fanLevels.sortOrder })
      .from(fanLevels)
      .where(eq(fanLevels.id, current.levelId))
      .limit(1);
    previousSort = prev?.sortOrder ?? -1;
  }

  await tx
    .update(artistFans)
    .set({
      superfanScore: score,
      dimensionRaw: raw,
      dimensionScores: { ...dims, recency: computeRecency(current?.lastActiveAt ?? null) },
      levelId: level?.id ?? null,
    })
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)));

  return {
    score,
    previousScore: current?.superfanScore ?? 0,
    levelId: level?.id ?? null,
    previousLevelId: current?.levelId ?? null,
    levelUp: Boolean(level) && level.sortOrder > previousSort && previousSort >= 0,
    level: level ?? null,
  };
}
