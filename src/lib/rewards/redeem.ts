import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb, type Database, type DbOrTx } from "@/db";
import { artistFans, fanLevels, fans, rewardRedemptions, rewards } from "@/db/schema";
import { track } from "@/lib/audit";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { awardPoints, InsufficientPointsError, spendPoints } from "@/lib/points/ledger";

export class RewardError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "not_active"
      | "not_started"
      | "ended"
      | "sold_out"
      | "insufficient_points"
      | "level_too_low"
      | "score_too_low"
      | "location_restricted"
      | "limit_reached"
      | "not_a_fan",
    message: string,
  ) {
    super(message);
    this.name = "RewardError";
  }
}

export type Reward = typeof rewards.$inferSelect;

export type EligibilityResult = {
  eligible: boolean;
  reason?: RewardError["code"];
  message?: string;
};

/**
 * Evaluate eligibility without side effects, for rendering "Redeem" buttons.
 */
export async function checkRewardEligibility(
  tx: DbOrTx,
  reward: Reward,
  af: { superfanScore: number; rewardPointsCached: number; levelId: string | null },
  fan: { city: string | null; country: string | null },
  redemptionsByFan: number,
  now = new Date(),
): Promise<EligibilityResult> {
  if (reward.status !== "active") return { eligible: false, reason: "not_active", message: "This reward is not available right now." };
  if (reward.startsAt && reward.startsAt > now) return { eligible: false, reason: "not_started", message: "This reward has not started yet." };
  if (reward.endsAt && reward.endsAt < now) return { eligible: false, reason: "ended", message: "This reward has ended." };
  if (reward.inventory != null && reward.redeemedCount >= reward.inventory) return { eligible: false, reason: "sold_out", message: "This reward is sold out." };
  if (redemptionsByFan >= reward.maxPerFan) return { eligible: false, reason: "limit_reached", message: "You have already redeemed this reward." };
  if (reward.minimumScore != null && af.superfanScore < reward.minimumScore) {
    return { eligible: false, reason: "score_too_low", message: `Requires a Superfan Score of ${reward.minimumScore.toLocaleString()}.` };
  }
  if (reward.minimumLevelId) {
    const [required] = await tx.select({ sortOrder: fanLevels.sortOrder, name: fanLevels.name }).from(fanLevels).where(eq(fanLevels.id, reward.minimumLevelId)).limit(1);
    let current = -1;
    if (af.levelId) {
      const [lvl] = await tx.select({ sortOrder: fanLevels.sortOrder }).from(fanLevels).where(eq(fanLevels.id, af.levelId)).limit(1);
      current = lvl?.sortOrder ?? -1;
    }
    if (required && current < required.sortOrder) {
      return { eligible: false, reason: "level_too_low", message: `Requires ${required.name} level or above.` };
    }
  }
  if (reward.locationRestriction) {
    const needle = reward.locationRestriction.trim().toLowerCase();
    const haystack = [fan.city, fan.country].filter(Boolean).map((s) => s!.toLowerCase());
    if (!haystack.some((h) => h.includes(needle))) {
      return { eligible: false, reason: "location_restricted", message: `Only available in ${reward.locationRestriction}.` };
    }
  }
  if (af.rewardPointsCached < reward.pointCost) {
    return { eligible: false, reason: "insufficient_points", message: `You need ${(reward.pointCost - af.rewardPointsCached).toLocaleString()} more points.` };
  }
  return { eligible: true };
}

/**
 * Redeem a reward. Atomic: locks the reward row, verifies inventory and
 * eligibility, spends points and records the redemption.
 */
export async function redeemReward(
  input: { artistId: string; fanId: string; rewardId: string },
  conn: Database = defaultDb,
) {
  return conn.transaction(async (tx) => {
    const [reward] = await tx
      .select()
      .from(rewards)
      .where(and(eq(rewards.id, input.rewardId), eq(rewards.artistId, input.artistId)))
      .for("update");
    if (!reward) throw new RewardError("not_found", "Reward not found.");

    const [af] = await tx
      .select()
      .from(artistFans)
      .where(and(eq(artistFans.artistId, input.artistId), eq(artistFans.fanId, input.fanId)))
      .for("update");
    if (!af) throw new RewardError("not_a_fan", "Join the fan club to redeem rewards.");

    const [fan] = await tx.select({ city: fans.city, country: fans.country }).from(fans).where(eq(fans.id, input.fanId)).limit(1);

    const [{ count: existing }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(rewardRedemptions)
      .where(
        and(
          eq(rewardRedemptions.rewardId, reward.id),
          eq(rewardRedemptions.fanId, input.fanId),
          sql`${rewardRedemptions.status} <> 'cancelled'`,
        ),
      );

    const eligibility = await checkRewardEligibility(tx, reward, af, fan ?? { city: null, country: null }, existing);
    if (!eligibility.eligible) {
      throw new RewardError(eligibility.reason ?? "not_active", eligibility.message ?? "Not eligible.");
    }

    // Reserve inventory first; the CHECK constraint is the last line of defense.
    const [updated] = await tx
      .update(rewards)
      .set({ redeemedCount: sql`${rewards.redeemedCount} + 1` })
      .where(
        and(
          eq(rewards.id, reward.id),
          sql`(${rewards.inventory} is null or ${rewards.redeemedCount} < ${rewards.inventory})`,
        ),
      )
      .returning({ id: rewards.id });
    if (!updated) throw new RewardError("sold_out", "This reward is sold out.");

    const [redemption] = await tx
      .insert(rewardRedemptions)
      .values({
        artistId: input.artistId,
        rewardId: reward.id,
        fanId: input.fanId,
        pointsSpent: reward.pointCost,
        status: reward.fulfillmentType === "digital" || reward.fulfillmentType === "access" ? "fulfilled" : "pending",
        fulfilledAt: reward.fulfillmentType === "digital" || reward.fulfillmentType === "access" ? new Date() : null,
      })
      .returning();

    try {
      await spendPoints(tx, {
        artistId: input.artistId,
        fanId: input.fanId,
        amount: reward.pointCost,
        type: "REDEMPTION",
        sourceId: redemption.id,
        description: `Redeemed ${reward.name}`,
      });
    } catch (err) {
      if (err instanceof InsufficientPointsError) {
        throw new RewardError("insufficient_points", "You do not have enough points.");
      }
      throw err;
    }

    await ingestEvent(
      {
        artistId: input.artistId,
        fanId: input.fanId,
        source: "superfan",
        type: EVENT_TYPES.rewardRedeemed,
        sourceEventId: `redemption:${redemption.id}`,
        metadata: { rewardId: reward.id, rewardName: reward.name, pointsSpent: reward.pointCost },
        summary: `Redeemed ${reward.name}`,
      },
      tx,
    );
    await track(tx, "reward_redeemed", { artistId: input.artistId, fanId: input.fanId }, { rewardId: reward.id, pointCost: reward.pointCost });

    return { redemption, reward };
  });
}

/** Cancel a pending redemption and refund the points (artist action). */
export async function cancelRedemption(
  input: { artistId: string; redemptionId: string; actorUserId: string | null; reason: string },
  conn: Database = defaultDb,
) {
  return conn.transaction(async (tx) => {
    const [redemption] = await tx
      .select()
      .from(rewardRedemptions)
      .where(and(eq(rewardRedemptions.id, input.redemptionId), eq(rewardRedemptions.artistId, input.artistId)))
      .for("update");
    if (!redemption || redemption.status === "cancelled") return null;

    await tx.update(rewardRedemptions).set({ status: "cancelled", fulfillmentNote: input.reason }).where(eq(rewardRedemptions.id, redemption.id));
    await tx.update(rewards).set({ redeemedCount: sql`greatest(0, ${rewards.redeemedCount} - 1)` }).where(eq(rewards.id, redemption.rewardId));

    await awardPoints(tx, {
      artistId: input.artistId,
      fanId: redemption.fanId,
      amount: redemption.pointsSpent,
      type: "REDEMPTION_REFUND",
      sourceId: redemption.id,
      description: `Refund: ${input.reason}`,
      actorUserId: input.actorUserId,
    });
    return redemption;
  });
}
