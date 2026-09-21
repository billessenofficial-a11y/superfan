import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { artistFans, rewardRedemptions, rewards } from "@/db/schema";
import { resolveActor } from "@/lib/identity/resolver";
import { awardPoints } from "@/lib/points/ledger";
import { redeemReward, RewardError } from "@/lib/rewards/redeem";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

async function fanWithPoints(artistId: string, points: number) {
  const actor = await resolveActor(db, { artistId, email: uniqueEmail(), source: "superfan" });
  if (points > 0) {
    await awardPoints(db, { artistId, fanId: actor.fanId, amount: points, type: "CAMPAIGN", sourceId: `seed:${actor.fanId}`, description: "seed" });
  }
  return actor.fanId;
}

describe("rewards", () => {
  it("cannot redeem when points < cost", async () => {
    const { artist } = await makeArtist();
    const [reward] = await db.insert(rewards).values({ artistId: artist.id, name: "Poster", pointCost: 750, inventory: 10, status: "active" }).returning();
    const fanId = await fanWithPoints(artist.id, 500);
    await expect(redeemReward({ artistId: artist.id, fanId, rewardId: reward.id }, db)).rejects.toMatchObject({ code: "insufficient_points" });
    const [af] = await db.select().from(artistFans).where(eq(artistFans.fanId, fanId));
    expect(af.rewardPointsCached).toBe(500);
  });

  it("spends points and records the redemption", async () => {
    const { artist } = await makeArtist();
    const [reward] = await db.insert(rewards).values({ artistId: artist.id, name: "Wallpapers", pointCost: 150, inventory: null, status: "active", fulfillmentType: "digital" }).returning();
    const fanId = await fanWithPoints(artist.id, 400);
    const res = await redeemReward({ artistId: artist.id, fanId, rewardId: reward.id }, db);
    expect(res.redemption.status).toBe("fulfilled");
    const [af] = await db.select().from(artistFans).where(eq(artistFans.fanId, fanId));
    expect(af.rewardPointsCached).toBe(250);
    const [updated] = await db.select().from(rewards).where(eq(rewards.id, reward.id));
    expect(updated.redeemedCount).toBe(1);
  });

  it("inventory cannot go negative", async () => {
    const { artist } = await makeArtist();
    const [reward] = await db.insert(rewards).values({ artistId: artist.id, name: "Test pressing", pointCost: 100, inventory: 1, status: "active", fulfillmentType: "physical" }).returning();
    const a = await fanWithPoints(artist.id, 1000);
    const b = await fanWithPoints(artist.id, 1000);
    await redeemReward({ artistId: artist.id, fanId: a, rewardId: reward.id }, db);
    await expect(redeemReward({ artistId: artist.id, fanId: b, rewardId: reward.id }, db)).rejects.toBeInstanceOf(RewardError);
    const [updated] = await db.select().from(rewards).where(eq(rewards.id, reward.id));
    expect(updated.redeemedCount).toBe(1);
    const all = await db.select().from(rewardRedemptions).where(eq(rewardRedemptions.rewardId, reward.id));
    expect(all).toHaveLength(1);
  });

  it("enforces per-fan limits, minimum score and status", async () => {
    const { artist } = await makeArtist();
    const [reward] = await db.insert(rewards).values({ artistId: artist.id, name: "Lottery", pointCost: 10, status: "active", fulfillmentType: "lottery", maxPerFan: 1, minimumScore: 100 }).returning();
    const fanId = await fanWithPoints(artist.id, 100);
    await expect(redeemReward({ artistId: artist.id, fanId, rewardId: reward.id }, db)).rejects.toMatchObject({ code: "score_too_low" });
    await db.update(artistFans).set({ superfanScore: 500 }).where(eq(artistFans.fanId, fanId));
    await redeemReward({ artistId: artist.id, fanId, rewardId: reward.id }, db);
    await expect(redeemReward({ artistId: artist.id, fanId, rewardId: reward.id }, db)).rejects.toMatchObject({ code: "limit_reached" });
    await db.update(rewards).set({ status: "paused" }).where(eq(rewards.id, reward.id));
    const other = await fanWithPoints(artist.id, 100);
    await expect(redeemReward({ artistId: artist.id, fanId: other, rewardId: reward.id }, db)).rejects.toMatchObject({ code: "not_active" });
  });

  it("a fan of artist A cannot redeem artist B's reward", async () => {
    const { artist: a } = await makeArtist();
    const { artist: b } = await makeArtist();
    const [reward] = await db.insert(rewards).values({ artistId: b.id, name: "B only", pointCost: 10, status: "active" }).returning();
    const fanId = await fanWithPoints(a.id, 100);
    await expect(redeemReward({ artistId: a.id, fanId, rewardId: reward.id }, db)).rejects.toMatchObject({ code: "not_found" });
  });
});
