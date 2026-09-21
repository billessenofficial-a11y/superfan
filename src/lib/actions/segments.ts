"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { segments, type SegmentGroup } from "@/db/schema";
import { audit, track } from "@/lib/audit";
import { requireArtistAccess } from "@/lib/auth/context";
import { countSegment, segmentGroupSchema } from "@/lib/segments/query";
import { act } from "./result";

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(80),
  description: z.string().max(300).optional(),
  rules: segmentGroupSchema,
});

export async function saveSegmentAction(input: z.input<typeof saveSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageSegments");
    const data = saveSchema.parse(input);
    const count = await countSegment(db, ctx.artist.id, data.rules as SegmentGroup);
    let id = data.id;
    if (id) {
      const [updated] = await db
        .update(segments)
        .set({ name: data.name, description: data.description ?? null, rules: data.rules as SegmentGroup, cachedCount: count, cachedAt: new Date() })
        .where(and(eq(segments.id, id), eq(segments.artistId, ctx.artist.id)))
        .returning({ id: segments.id });
      if (!updated) throw Object.assign(new Error("Segment not found."), { code: "not_found" });
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "segment.edited", targetType: "segment", targetId: id });
    } else {
      const [created] = await db
        .insert(segments)
        .values({ artistId: ctx.artist.id, name: data.name, description: data.description ?? null, rules: data.rules as SegmentGroup, cachedCount: count, cachedAt: new Date(), createdByUserId: ctx.user.id })
        .returning({ id: segments.id });
      id = created.id;
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "segment.created", targetType: "segment", targetId: id });
      await track(db, "segment_created", { artistId: ctx.artist.id, userId: ctx.user.id }, { conditions: data.rules.children.length });
    }
    revalidatePath("/app/segments");
    return { id, count };
  });
}

export async function deleteSegmentAction(input: { id: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageSegments");
    await db.delete(segments).where(and(eq(segments.id, input.id), eq(segments.artistId, ctx.artist.id)));
    revalidatePath("/app/segments");
  });
}

/** Live audience count while building rules. */
export async function previewSegmentCount(input: { rules: unknown }) {
  return act(async () => {
    const ctx = await requireArtistAccess("viewFans");
    const rules = segmentGroupSchema.parse(input.rules);
    const count = await countSegment(db, ctx.artist.id, rules as SegmentGroup);
    return { count };
  });
}

export async function refreshSegmentCount(input: { id: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("viewFans");
    const [seg] = await db.select().from(segments).where(and(eq(segments.id, input.id), eq(segments.artistId, ctx.artist.id))).limit(1);
    if (!seg) throw Object.assign(new Error("Segment not found."), { code: "not_found" });
    const count = await countSegment(db, ctx.artist.id, seg.rules);
    await db.update(segments).set({ cachedCount: count, cachedAt: new Date() }).where(eq(segments.id, seg.id));
    revalidatePath("/app/segments");
    return { count };
  });
}
