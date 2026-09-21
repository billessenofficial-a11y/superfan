"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { campaigns } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireArtistAccess } from "@/lib/auth/context";
import { act } from "./result";

const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : null));
const optionalUuid = z.union([z.string().uuid(), z.literal(""), z.null()]).optional().transform((v) => (v ? v : null));

const campaignSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(120),
  description: z.string().max(1000).optional(),
  type: z.enum(["challenge", "reward_drop", "vip_access", "promo_code", "fan_survey", "event"]),
  status: z.enum(["draft", "scheduled", "live", "ended"]).default("draft"),
  segmentId: optionalUuid,
  minimumScore: z.number().int().min(0).nullable().optional(),
  minimumLevelId: optionalUuid,
  capacity: z.number().int().min(0).nullable().optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
  challengeId: optionalUuid,
  rewardId: optionalUuid,
  eventId: optionalUuid,
  config: z.record(z.string(), z.unknown()).default({}),
});

export async function saveCampaignAction(input: z.input<typeof campaignSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageCampaigns");
    const data = campaignSchema.parse(input);
    const values = {
      name: data.name,
      description: data.description ?? null,
      type: data.type,
      status: data.status,
      segmentId: data.segmentId,
      minimumScore: data.minimumScore ?? null,
      minimumLevelId: data.minimumLevelId,
      capacity: data.capacity ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      challengeId: data.challengeId,
      rewardId: data.rewardId,
      eventId: data.eventId,
      config: data.config,
    };
    let id = data.id;
    if (id) {
      const [updated] = await db.update(campaigns).set(values).where(and(eq(campaigns.id, id), eq(campaigns.artistId, ctx.artist.id))).returning({ id: campaigns.id });
      if (!updated) throw Object.assign(new Error("Campaign not found."), { code: "not_found" });
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "campaign.edited", targetType: "campaign", targetId: id, metadata: { name: data.name, status: data.status } });
    } else {
      const [created] = await db.insert(campaigns).values({ ...values, artistId: ctx.artist.id, createdByUserId: ctx.user.id }).returning({ id: campaigns.id });
      id = created.id;
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "campaign.created", targetType: "campaign", targetId: id, metadata: { name: data.name, type: data.type } });
    }
    revalidatePath("/app/campaigns");
    return { id };
  });
}

export async function setCampaignStatusAction(input: { id: string; status: "draft" | "scheduled" | "live" | "ended" }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageCampaigns");
    await db.update(campaigns).set({ status: input.status }).where(and(eq(campaigns.id, input.id), eq(campaigns.artistId, ctx.artist.id)));
    revalidatePath("/app/campaigns");
  });
}

export async function deleteCampaignAction(input: { id: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageCampaigns");
    await db.delete(campaigns).where(and(eq(campaigns.id, input.id), eq(campaigns.artistId, ctx.artist.id)));
    revalidatePath("/app/campaigns");
  });
}
