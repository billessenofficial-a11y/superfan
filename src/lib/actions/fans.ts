"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { artistFans, fanLevels, fanNotes, fanTagAssignments, fanTags, fans } from "@/db/schema";
import { audit } from "@/lib/audit";
import { requireArtistAccess } from "@/lib/auth/context";
import { checkInFan } from "@/lib/checkins";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { buildFanFilters, type FanListFilters } from "@/lib/fans/queries";
import { mergeFans } from "@/lib/identity/merge";
import { adjustPoints } from "@/lib/points/ledger";
import { DIMENSIONS } from "@/lib/scoring/defaults";
import { act } from "./result";

async function assertFanInArtist(artistId: string, fanId: string) {
  const [row] = await db.select({ id: artistFans.id }).from(artistFans).where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId))).limit(1);
  if (!row) throw Object.assign(new Error("Fan not found."), { code: "not_found" });
}

const pointsSchema = z.object({ fanId: z.string().uuid(), amount: z.number().int().refine((n) => n !== 0, "Amount cannot be zero").min(-100000).max(100000), reason: z.string().min(3, "A reason is required").max(300) });

/** Manually add or remove reward points. Requires a reason; always audited. */
export async function adjustPointsAction(input: z.input<typeof pointsSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("adjustPoints");
    const data = pointsSchema.parse(input);
    await assertFanInArtist(ctx.artist.id, data.fanId);
    const res = await db.transaction(async (tx) => {
      const r = await adjustPoints(tx, { artistId: ctx.artist.id, fanId: data.fanId, amount: data.amount, reason: data.reason, actorUserId: ctx.user.id });
      await audit(tx, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "points.adjusted", targetType: "fan", targetId: data.fanId, metadata: { amount: data.amount, reason: data.reason } });
      return r;
    });
    revalidatePath(`/app/fans/${data.fanId}`);
    return { balance: res.balance };
  });
}

const scoreSchema = z.object({ fanId: z.string().uuid(), points: z.number().int().refine((n) => n !== 0).min(-100000).max(100000), dimension: z.enum(["commerce", "attendance", "engagement", "advocacy", "community"]), reason: z.string().min(3).max(300) });

/** Manual Superfan Score adjustment, recorded as an event + ledger row. */
export async function adjustScoreAction(input: z.input<typeof scoreSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("adjustPoints");
    const data = scoreSchema.parse(input);
    if (!(DIMENSIONS as string[]).includes(data.dimension)) throw new Error("Invalid dimension");
    await assertFanInArtist(ctx.artist.id, data.fanId);
    const res = await ingestEvent({
      artistId: ctx.artist.id,
      fanId: data.fanId,
      source: "manual",
      type: EVENT_TYPES.manualScoreAdjustment,
      verification: "artist_verified",
      metadata: { points: data.points, dimension: data.dimension, reason: data.reason, actorUserId: ctx.user.id },
      summary: `${data.points > 0 ? "+" : ""}${data.points} score · ${data.reason}`,
    });
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "score.adjusted", targetType: "fan", targetId: data.fanId, metadata: { points: data.points, dimension: data.dimension, reason: data.reason } });
    revalidatePath(`/app/fans/${data.fanId}`);
    return { score: res.score };
  });
}

export async function addNoteAction(input: { fanId: string; body: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("editFans");
    const data = z.object({ fanId: z.string().uuid(), body: z.string().min(1).max(2000) }).parse(input);
    await assertFanInArtist(ctx.artist.id, data.fanId);
    await db.insert(fanNotes).values({ artistId: ctx.artist.id, fanId: data.fanId, authorUserId: ctx.user.id, body: data.body });
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "fan.note_added", targetType: "fan", targetId: data.fanId });
    revalidatePath(`/app/fans/${data.fanId}`);
  });
}

export async function createTagAction(input: { name: string; color?: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("editFans");
    const data = z.object({ name: z.string().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).parse(input);
    const [tag] = await db.insert(fanTags).values({ artistId: ctx.artist.id, name: data.name, color: data.color ?? "#a78bfa" }).onConflictDoNothing().returning();
    revalidatePath("/app/fans");
    return tag ?? null;
  });
}

export async function toggleTagAction(input: { fanId: string; tagId: string; on: boolean }) {
  return act(async () => {
    const ctx = await requireArtistAccess("editFans");
    const data = z.object({ fanId: z.string().uuid(), tagId: z.string().uuid(), on: z.boolean() }).parse(input);
    await assertFanInArtist(ctx.artist.id, data.fanId);
    const [tag] = await db.select().from(fanTags).where(and(eq(fanTags.id, data.tagId), eq(fanTags.artistId, ctx.artist.id))).limit(1);
    if (!tag) throw Object.assign(new Error("Tag not found."), { code: "not_found" });
    if (data.on) {
      await db.insert(fanTagAssignments).values({ artistId: ctx.artist.id, tagId: tag.id, fanId: data.fanId }).onConflictDoNothing();
    } else {
      await db.delete(fanTagAssignments).where(and(eq(fanTagAssignments.tagId, tag.id), eq(fanTagAssignments.fanId, data.fanId)));
    }
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "fan.tagged", targetType: "fan", targetId: data.fanId, metadata: { tag: tag.name, on: data.on } });
    revalidatePath(`/app/fans/${data.fanId}`);
  });
}

/** Staff-verified attendance for an event (no QR needed). */
export async function verifyAttendanceAction(input: { fanId: string; eventId: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("editFans");
    const data = z.object({ fanId: z.string().uuid(), eventId: z.string().uuid() }).parse(input);
    await assertFanInArtist(ctx.artist.id, data.fanId);
    const res = await checkInFan({ eventId: data.eventId, fanId: data.fanId, method: "staff", verifiedByUserId: ctx.user.id });
    if (res.event.artistId !== ctx.artist.id) throw Object.assign(new Error("Event not found."), { code: "not_found" });
    revalidatePath(`/app/fans/${data.fanId}`);
    return { eventName: res.event.name };
  });
}

/** Artist-approved manual merge of two fan profiles. */
export async function mergeFansAction(input: { sourceFanId: string; targetFanId: string; reason: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("adjustPoints");
    const data = z.object({ sourceFanId: z.string().uuid(), targetFanId: z.string().uuid(), reason: z.string().min(3).max(300) }).parse(input);
    await assertFanInArtist(ctx.artist.id, data.sourceFanId);
    await assertFanInArtist(ctx.artist.id, data.targetFanId);
    await db.transaction((tx) => mergeFans(tx, { ...data, actorUserId: ctx.user.id, artistId: ctx.artist.id }));
    revalidatePath("/app/fans");
  });
}

export async function updateFanProfileByArtist(input: { fanId: string; firstName?: string; lastName?: string; city?: string; country?: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("editFans");
    const data = z.object({ fanId: z.string().uuid(), firstName: z.string().max(80).optional(), lastName: z.string().max(80).optional(), city: z.string().max(80).optional(), country: z.string().max(80).optional() }).parse(input);
    await assertFanInArtist(ctx.artist.id, data.fanId);
    const { fanId, ...rest } = data;
    await db.update(fans).set(rest).where(eq(fans.id, fanId));
    revalidatePath(`/app/fans/${fanId}`);
  });
}

/** Export the current fan list (with filters) as CSV. */
export async function exportFansCsv(filters: FanListFilters) {
  return act(async () => {
    const ctx = await requireArtistAccess("exportFans");
    const where = buildFanFilters(ctx.artist.id, filters);
    const rows = await db
      .select({ email: fans.email, firstName: fans.firstName, lastName: fans.lastName, city: fans.city, country: fans.country, score: artistFans.superfanScore, points: artistFans.rewardPointsCached, level: fanLevels.name, spend: artistFans.lifetimeSpendCents, events: artistFans.eventsAttendedCount, referrals: artistFans.referralsCount, lastActive: artistFans.lastActiveAt })
      .from(artistFans)
      .innerJoin(fans, eq(fans.id, artistFans.fanId))
      .leftJoin(fanLevels, eq(fanLevels.id, artistFans.levelId))
      .where(and(...where))
      .orderBy(desc(artistFans.superfanScore))
      .limit(10_000);
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ["email", "first_name", "last_name", "city", "country", "level", "superfan_score", "reward_points", "lifetime_spend", "events_attended", "referrals", "last_active"];
    const lines = [header.join(","), ...rows.map((r) => [r.email, r.firstName, r.lastName, r.city, r.country, r.level, r.score, r.points, (r.spend / 100).toFixed(2), r.events, r.referrals, r.lastActive?.toISOString() ?? ""].map(esc).join(","))];
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "fans.exported", metadata: { count: rows.length } });
    return { csv: lines.join("\n"), count: rows.length };
  });
}
