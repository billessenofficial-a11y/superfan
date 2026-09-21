"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { rewardRedemptions, rewards } from "@/db/schema";
import { audit, track } from "@/lib/audit";
import { requireArtistAccess } from "@/lib/auth/context";
import { cancelRedemption } from "@/lib/rewards/redeem";
import { act } from "./result";

const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : null));

const rewardSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  pointCost: z.number().int().min(0).max(1_000_000),
  inventory: z.number().int().min(0).nullable(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  minimumLevelId: z.string().uuid().nullable().optional(),
  minimumScore: z.number().int().min(0).nullable().optional(),
  locationRestriction: z.string().max(80).optional(),
  fulfillmentType: z.enum(["digital", "physical", "access", "lottery", "manual"]),
  status: z.enum(["draft", "active", "paused", "ended", "archived"]),
  maxPerFan: z.number().int().min(1).max(100).default(1),
});

export async function saveRewardAction(input: z.input<typeof rewardSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageRewards");
    const data = rewardSchema.parse(input);
    const values = {
      name: data.name,
      description: data.description ?? null,
      imageUrl: data.imageUrl || null,
      pointCost: data.pointCost,
      inventory: data.inventory,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      minimumLevelId: data.minimumLevelId ?? null,
      minimumScore: data.minimumScore ?? null,
      locationRestriction: data.locationRestriction || null,
      fulfillmentType: data.fulfillmentType,
      status: data.status,
      maxPerFan: data.maxPerFan,
    };
    let id = data.id;
    if (id) {
      const [existing] = await db.select({ redeemedCount: rewards.redeemedCount }).from(rewards).where(and(eq(rewards.id, id), eq(rewards.artistId, ctx.artist.id))).limit(1);
      if (!existing) throw Object.assign(new Error("Reward not found."), { code: "not_found" });
      if (values.inventory != null && values.inventory < existing.redeemedCount) {
        throw Object.assign(new Error(`Inventory cannot be lower than the ${existing.redeemedCount} already redeemed.`), { code: "validation" });
      }
      await db.update(rewards).set(values).where(and(eq(rewards.id, id), eq(rewards.artistId, ctx.artist.id)));
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "reward.edited", targetType: "reward", targetId: id, metadata: { name: data.name, status: data.status } });
    } else {
      const [created] = await db.insert(rewards).values({ ...values, artistId: ctx.artist.id, createdByUserId: ctx.user.id }).returning({ id: rewards.id });
      id = created.id;
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "reward.created", targetType: "reward", targetId: id, metadata: { name: data.name } });
      await track(db, "reward_created", { artistId: ctx.artist.id, userId: ctx.user.id }, { fulfillmentType: data.fulfillmentType, pointCost: data.pointCost });
    }
    revalidatePath("/app/rewards");
    return { id };
  });
}

export async function setRewardStatusAction(input: { id: string; status: "draft" | "active" | "paused" | "ended" | "archived" }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageRewards");
    await db.update(rewards).set({ status: input.status }).where(and(eq(rewards.id, input.id), eq(rewards.artistId, ctx.artist.id)));
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "reward.edited", targetType: "reward", targetId: input.id, metadata: { status: input.status } });
    revalidatePath("/app/rewards");
  });
}

export async function fulfillRedemptionAction(input: { redemptionId: string; note?: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageRewards");
    const [row] = await db
      .update(rewardRedemptions)
      .set({ status: "fulfilled", fulfilledAt: new Date(), fulfillmentNote: input.note ?? null })
      .where(and(eq(rewardRedemptions.id, input.redemptionId), eq(rewardRedemptions.artistId, ctx.artist.id), eq(rewardRedemptions.status, "pending")))
      .returning({ id: rewardRedemptions.id, fanId: rewardRedemptions.fanId });
    if (!row) throw Object.assign(new Error("Redemption not found or already handled."), { code: "not_found" });
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "reward.fulfilled", targetType: "redemption", targetId: row.id });
    revalidatePath("/app/rewards");
    revalidatePath(`/app/fans/${row.fanId}`);
  });
}

export async function cancelRedemptionAction(input: { redemptionId: string; reason: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageRewards");
    const reason = z.string().min(3).max(300).parse(input.reason);
    const res = await cancelRedemption({ artistId: ctx.artist.id, redemptionId: input.redemptionId, actorUserId: ctx.user.id, reason });
    if (!res) throw Object.assign(new Error("Redemption not found or already cancelled."), { code: "not_found" });
    revalidatePath("/app/rewards");
    revalidatePath(`/app/fans/${res.fanId}`);
  });
}
