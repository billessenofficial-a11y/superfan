"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { challenges, type ChallengeConfig } from "@/db/schema";
import { audit, track } from "@/lib/audit";
import { requireArtistAccess } from "@/lib/auth/context";
import { completeChallenge } from "@/lib/challenges/complete";
import { act } from "./result";

const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : null));

const configSchema = z.object({
  questions: z.array(z.object({ id: z.string().min(1), question: z.string().min(1).max(300), options: z.array(z.string().min(1).max(120)).min(2).max(6), answerIndex: z.number().int().min(0) })).max(20).optional(),
  passScore: z.number().int().min(1).optional(),
  code: z.string().max(60).optional(),
  url: z.string().url().optional(),
  fields: z.array(z.object({ key: z.string().min(1).max(40), label: z.string().min(1).max(120), type: z.enum(["text", "textarea", "select"]), options: z.array(z.string()).optional(), required: z.boolean().optional() })).max(12).optional(),
  eventId: z.string().uuid().optional(),
  minimumAmountCents: z.number().int().min(0).optional(),
  referralsRequired: z.number().int().min(1).max(100).optional(),
});

const challengeSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Title is required").max(120),
  description: z.string().max(1000).optional(),
  type: z.enum(["manual", "quiz", "referral", "event_checkin", "promo_code", "link_visit", "form_submission", "purchase"]),
  status: z.enum(["draft", "active", "ended", "archived"]),
  points: z.number().int().min(0).max(100000),
  isMajor: z.boolean().default(false),
  imageUrl: z.string().url().optional().or(z.literal("")),
  config: configSchema.default({}),
  startsAt: optionalDate,
  endsAt: optionalDate,
  maxCompletions: z.number().int().min(1).nullable().optional(),
});

function validateConfig(type: z.infer<typeof challengeSchema>["type"], cfg: ChallengeConfig) {
  if (type === "quiz" && (!cfg.questions || cfg.questions.length === 0)) throw Object.assign(new Error("Add at least one quiz question."), { code: "validation" });
  if (type === "promo_code" && !cfg.code?.trim()) throw Object.assign(new Error("Enter the promo code fans must submit."), { code: "validation" });
  if (type === "link_visit" && !cfg.url) throw Object.assign(new Error("Enter the link fans should visit."), { code: "validation" });
  if (type === "event_checkin" && !cfg.eventId) throw Object.assign(new Error("Pick the event for this challenge."), { code: "validation" });
  if (type === "quiz" && cfg.questions) {
    for (const q of cfg.questions) if (q.answerIndex >= q.options.length) throw Object.assign(new Error(`"${q.question}" has an invalid correct answer.`), { code: "validation" });
  }
}

export async function saveChallengeAction(input: z.input<typeof challengeSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageChallenges");
    const data = challengeSchema.parse(input);
    const config = data.config as ChallengeConfig;
    validateConfig(data.type, config);
    if (config.code) config.code = config.code.trim().toUpperCase();
    const values = {
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      status: data.status,
      points: data.points,
      isMajor: data.isMajor,
      imageUrl: data.imageUrl || null,
      config,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      maxCompletions: data.maxCompletions ?? null,
    };
    let id = data.id;
    if (id) {
      const [updated] = await db.update(challenges).set(values).where(and(eq(challenges.id, id), eq(challenges.artistId, ctx.artist.id))).returning({ id: challenges.id });
      if (!updated) throw Object.assign(new Error("Challenge not found."), { code: "not_found" });
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "challenge.edited", targetType: "challenge", targetId: id, metadata: { title: data.title, status: data.status } });
    } else {
      const [created] = await db.insert(challenges).values({ ...values, artistId: ctx.artist.id, createdByUserId: ctx.user.id }).returning({ id: challenges.id });
      id = created.id;
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "challenge.created", targetType: "challenge", targetId: id, metadata: { title: data.title, type: data.type } });
      await track(db, "challenge_created", { artistId: ctx.artist.id, userId: ctx.user.id }, { type: data.type, points: data.points });
    }
    revalidatePath("/app/challenges");
    return { id };
  });
}

export async function setChallengeStatusAction(input: { id: string; status: "draft" | "active" | "ended" | "archived" }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageChallenges");
    await db.update(challenges).set({ status: input.status }).where(and(eq(challenges.id, input.id), eq(challenges.artistId, ctx.artist.id)));
    await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "challenge.edited", targetType: "challenge", targetId: input.id, metadata: { status: input.status } });
    revalidatePath("/app/challenges");
  });
}

/** Team member marks a manual challenge as completed for a fan. */
export async function approveManualCompletionAction(input: { challengeId: string; fanId: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageChallenges");
    const data = z.object({ challengeId: z.string().uuid(), fanId: z.string().uuid() }).parse(input);
    const res = await completeChallenge({ artistId: ctx.artist.id, fanId: data.fanId, challengeId: data.challengeId, submission: { approvedByUserId: ctx.user.id }, actorUserId: ctx.user.id });
    revalidatePath(`/app/fans/${data.fanId}`);
    revalidatePath("/app/challenges");
    return { points: res.challenge.points };
  });
}
