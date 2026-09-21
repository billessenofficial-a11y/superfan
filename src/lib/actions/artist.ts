"use server";

import { and, eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { artistInvites, artistMembers, artists, fanLevels, scoreRules, users } from "@/db/schema";
import { createArtist, getArtistBySlug, slugify } from "@/lib/artists/create";
import { audit, track } from "@/lib/audit";
import { ARTIST_COOKIE, requireArtistAccess, requireUser } from "@/lib/auth/context";
import { randomToken, sha256 } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { DIMENSIONS } from "@/lib/scoring/defaults";
import { recomputeFanScore } from "@/lib/scoring/engine";
import { act } from "./result";

const createSchema = z.object({
  name: z.string().min(1, "Artist name is required").max(80),
  slug: z.string().min(2).max(48).regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes"),
  genre: z.string().max(60).optional(),
  country: z.string().max(60).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function createArtistAction(input: z.input<typeof createSchema>) {
  return act(async () => {
    const user = await requireUser("/onboarding");
    const data = createSchema.parse({ ...input, slug: input.slug || slugify(input.name) });
    if (await getArtistBySlug(db, data.slug)) throw Object.assign(new Error("That URL is already taken."), { code: "slug_taken" });
    const artist = await db.transaction((tx) => createArtist(tx, { ...data, createdByUserId: user.id }));
    await audit(db, { artistId: artist.id, actorUserId: user.id, action: "artist.created", targetType: "artist", targetId: artist.id });
    await track(db, "artist_created", { artistId: artist.id, userId: user.id });
    const cookieStore = await cookies();
    cookieStore.set(ARTIST_COOKIE, artist.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return { id: artist.id, slug: artist.slug };
  });
}

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  genre: z.string().max(60).nullable().optional(),
  country: z.string().max(60).nullable().optional(),
  bio: z.string().max(600).nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  followerCount: z.number().int().min(0).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export async function updateArtistAction(input: z.input<typeof updateSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageArtist");
    const data = updateSchema.parse(input);
    const { settings, ...rest } = data;
    await db
      .update(artists)
      .set({ ...rest, ...(settings ? { settings: { ...ctx.artist.settings, ...settings } } : {}) })
      .where(eq(artists.id, ctx.artist.id));
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "artist.updated", targetType: "artist", targetId: ctx.artist.id, metadata: { fields: Object.keys(data) } });
    revalidatePath("/app", "layout");
  });
}

export async function markOnboarded() {
  const ctx = await requireArtistAccess();
  await db.update(artists).set({ onboardedAt: new Date() }).where(eq(artists.id, ctx.artist.id));
  redirect("/app");
}

/* ───────────────────────── Scoring configuration ───────────────────────── */

const weightsSchema = z.object({
  commerce: z.number().min(0).max(100),
  attendance: z.number().min(0).max(100),
  engagement: z.number().min(0).max(100),
  advocacy: z.number().min(0).max(100),
  community: z.number().min(0).max(100),
});

export async function updateScoreWeights(input: z.input<typeof weightsSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageScoring");
    const weights = weightsSchema.parse(input);
    const total = DIMENSIONS.reduce((s, d) => s + weights[d], 0);
    if (Math.round(total) !== 100) throw Object.assign(new Error("Weights must add up to 100%."), { code: "validation" });
    await db.update(artists).set({ scoreWeights: weights }).where(eq(artists.id, ctx.artist.id));
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "score_weights.changed", metadata: { weights } });
    await recomputeAllScores(ctx.artist.id);
    revalidatePath("/app", "layout");
  });
}

const ruleSchema = z.object({
  id: z.string().uuid(),
  points: z.number().int().min(-10000).max(10000),
  enabled: z.boolean(),
  capPoints: z.number().int().min(0).max(100000).nullable(),
  capWindow: z.enum(["day", "week", "month", "lifetime"]).nullable(),
});

export async function updateScoreRules(input: { rules: z.input<typeof ruleSchema>[] }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageScoring");
    const rules = z.array(ruleSchema).max(100).parse(input.rules);
    await db.transaction(async (tx) => {
      for (const r of rules) {
        await tx
          .update(scoreRules)
          .set({ points: r.points, enabled: r.enabled, capPoints: r.capPoints, capWindow: r.capPoints == null ? null : (r.capWindow ?? "week") })
          .where(and(eq(scoreRules.id, r.id), eq(scoreRules.artistId, ctx.artist.id)));
      }
      await audit(tx, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "score_rule.changed", metadata: { count: rules.length } });
    });
    revalidatePath("/app/settings");
  });
}

const levelsSchema = z.array(z.object({ id: z.string().uuid().optional(), name: z.string().min(1).max(40), minScore: z.number().int().min(0), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).min(2).max(10);

export async function updateLevels(input: { levels: z.input<typeof levelsSchema> }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageScoring");
    const levels = levelsSchema.parse(input.levels).sort((a, b) => a.minScore - b.minScore);
    if (levels[0].minScore !== 0) throw Object.assign(new Error("The first level must start at 0."), { code: "validation" });
    await db.transaction(async (tx) => {
      const existing = await tx.select({ id: fanLevels.id }).from(fanLevels).where(eq(fanLevels.artistId, ctx.artist.id));
      const keep = new Set(levels.map((l) => l.id).filter(Boolean));
      for (const e of existing) if (!keep.has(e.id)) await tx.delete(fanLevels).where(eq(fanLevels.id, e.id));
      // Two-phase sort order update to avoid unique collisions.
      for (const [i, l] of levels.entries()) {
        if (l.id) await tx.update(fanLevels).set({ sortOrder: 1000 + i }).where(and(eq(fanLevels.id, l.id), eq(fanLevels.artistId, ctx.artist.id)));
      }
      for (const [i, l] of levels.entries()) {
        if (l.id) {
          await tx.update(fanLevels).set({ name: l.name, minScore: l.minScore, color: l.color, sortOrder: i }).where(and(eq(fanLevels.id, l.id), eq(fanLevels.artistId, ctx.artist.id)));
        } else {
          await tx.insert(fanLevels).values({ artistId: ctx.artist.id, name: l.name, minScore: l.minScore, color: l.color, sortOrder: i });
        }
      }
      await audit(tx, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "levels.changed", metadata: { levels: levels.map((l) => `${l.name}:${l.minScore}`) } });
    });
    await recomputeAllScores(ctx.artist.id);
    revalidatePath("/app", "layout");
  });
}

/** Recompute every cached score for an artist (after rule/weight/level changes). */
async function recomputeAllScores(artistId: string) {
  const rows = await db.execute<{ fan_id: string }>(sql`select fan_id from artist_fans where artist_id = ${artistId}`);
  const list = Array.isArray(rows) ? rows : (rows as unknown as { rows: { fan_id: string }[] }).rows ?? [];
  for (const r of list) await recomputeFanScore(db, artistId, r.fan_id);
}

/* ───────────────────────── Team ───────────────────────── */

const inviteSchema = z.object({ email: z.string().email(), role: z.enum(["admin", "marketing", "community", "viewer"]) });

export async function inviteMember(input: z.input<typeof inviteSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageTeam");
    const { email, role } = inviteSchema.parse(input);
    const normalized = email.toLowerCase();
    const [existingUser] = await db.select().from(users).where(sql`lower(${users.email}) = ${normalized}`).limit(1);
    if (existingUser) {
      await db.insert(artistMembers).values({ artistId: ctx.artist.id, userId: existingUser.id, role, invitedByUserId: ctx.user.id, invitedEmail: normalized, acceptedAt: new Date() }).onConflictDoNothing();
    } else {
      const token = randomToken(24);
      await db.insert(artistInvites).values({ artistId: ctx.artist.id, email: normalized, role, invitedByUserId: ctx.user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86_400_000) });
      const url = appUrl(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
      await sendEmail({ to: normalized, subject: `You're invited to ${ctx.artist.name} on Superfan`, html: `<p>${ctx.user.displayName ?? ctx.user.email} invited you to join <strong>${ctx.artist.name}</strong> on Superfan as ${role}.</p><p><a href="${url}">Accept invitation</a></p>`, text: `Accept your invitation: ${url}` });
    }
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "member.invited", metadata: { email: normalized, role } });
    revalidatePath("/app/settings");
  });
}

export async function acceptInvite(token: string) {
  const user = await requireUser(`/invite/${token}`);
  const [invite] = await db.select().from(artistInvites).where(eq(artistInvites.tokenHash, sha256(token))).limit(1);
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) redirect("/app?invite=invalid");
  await db.transaction(async (tx) => {
    await tx.insert(artistMembers).values({ artistId: invite.artistId, userId: user.id, role: invite.role, invitedByUserId: invite.invitedByUserId, invitedEmail: invite.email, acceptedAt: new Date() }).onConflictDoNothing();
    await tx.update(artistInvites).set({ acceptedAt: new Date() }).where(eq(artistInvites.id, invite.id));
  });
  const cookieStore = await cookies();
  cookieStore.set(ARTIST_COOKIE, invite.artistId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/app");
}

export async function updateMemberRole(input: { memberId: string; role: "admin" | "marketing" | "community" | "viewer" }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageTeam");
    const [m] = await db.select().from(artistMembers).where(and(eq(artistMembers.id, input.memberId), eq(artistMembers.artistId, ctx.artist.id))).limit(1);
    if (!m || m.role === "owner") throw Object.assign(new Error("Cannot change the owner."), { code: "forbidden" });
    await db.update(artistMembers).set({ role: input.role }).where(eq(artistMembers.id, m.id));
    revalidatePath("/app/settings");
  });
}

export async function removeMember(input: { memberId: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageTeam");
    const [m] = await db.select().from(artistMembers).where(and(eq(artistMembers.id, input.memberId), eq(artistMembers.artistId, ctx.artist.id))).limit(1);
    if (!m || m.role === "owner") throw Object.assign(new Error("Cannot remove the owner."), { code: "forbidden" });
    await db.delete(artistMembers).where(eq(artistMembers.id, m.id));
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "member.removed", targetType: "user", targetId: m.userId });
    revalidatePath("/app/settings");
  });
}
