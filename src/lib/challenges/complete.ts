import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb, type Database } from "@/db";
import { artistFans, challengeCompletions, challenges, eventCheckins, referrals } from "@/db/schema";
import { track } from "@/lib/audit";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { awardPoints } from "@/lib/points/ledger";

export class ChallengeError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "not_active"
      | "not_started"
      | "ended"
      | "already_completed"
      | "full"
      | "invalid_submission"
      | "requirements_not_met"
      | "not_a_fan",
    message: string,
  ) {
    super(message);
    this.name = "ChallengeError";
  }
}

export type Challenge = typeof challenges.$inferSelect;

export type ChallengeSubmission = {
  /** quiz: selected option index per question id */
  answers?: Record<string, number>;
  /** promo_code */
  code?: string;
  /** form_submission */
  fields?: Record<string, string>;
  /** link_visit: client confirms the visit */
  visited?: boolean;
  /** manual: artist-side approval */
  approvedByUserId?: string;
};

/**
 * Validate a submission against the challenge type. Returns a normalized
 * submission to store, or throws ChallengeError.
 */
export async function validateSubmission(
  tx: Database | Parameters<Parameters<Database["transaction"]>[0]>[0],
  challenge: Challenge,
  fanId: string,
  submission: ChallengeSubmission,
): Promise<Record<string, unknown>> {
  const cfg = challenge.config;
  switch (challenge.type) {
    case "quiz": {
      const questions = cfg.questions ?? [];
      if (questions.length === 0) return { answers: submission.answers ?? {} };
      const answers = submission.answers ?? {};
      let correct = 0;
      for (const q of questions) if (answers[q.id] === q.answerIndex) correct++;
      const needed = cfg.passScore ?? questions.length;
      if (correct < needed) {
        throw new ChallengeError("invalid_submission", `You got ${correct} of ${questions.length} right. You need ${needed} to pass.`);
      }
      return { answers, correct, total: questions.length };
    }
    case "promo_code": {
      const expected = (cfg.code ?? "").trim().toUpperCase();
      const given = (submission.code ?? "").trim().toUpperCase();
      if (!expected || given !== expected) throw new ChallengeError("invalid_submission", "That code is not valid.");
      return { code: given };
    }
    case "form_submission": {
      const fields = cfg.fields ?? [];
      const given = submission.fields ?? {};
      for (const f of fields) {
        if (f.required && !given[f.key]?.trim()) {
          throw new ChallengeError("invalid_submission", `"${f.label}" is required.`);
        }
      }
      return { fields: given };
    }
    case "link_visit":
      if (!submission.visited) throw new ChallengeError("invalid_submission", "Open the link first.");
      return { visited: true, url: cfg.url };
    case "event_checkin": {
      if (!cfg.eventId) throw new ChallengeError("requirements_not_met", "This challenge is not linked to an event.");
      const [checkin] = await tx
        .select({ id: eventCheckins.id })
        .from(eventCheckins)
        .where(and(eq(eventCheckins.eventId, cfg.eventId), eq(eventCheckins.fanId, fanId)))
        .limit(1);
      if (!checkin) throw new ChallengeError("requirements_not_met", "Check in at the show to complete this challenge.");
      return { checkinId: checkin.id };
    }
    case "referral": {
      const required = cfg.referralsRequired ?? 1;
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(referrals)
        .where(and(eq(referrals.artistId, challenge.artistId), eq(referrals.referrerFanId, fanId), eq(referrals.status, "qualified")));
      if (count < required) throw new ChallengeError("requirements_not_met", `Refer ${required - count} more ${required - count === 1 ? "friend" : "friends"} to complete this.`);
      return { referrals: count };
    }
    case "purchase": {
      const min = cfg.minimumAmountCents ?? 1;
      const [af] = await tx
        .select({ spend: artistFans.lifetimeSpendCents })
        .from(artistFans)
        .where(and(eq(artistFans.artistId, challenge.artistId), eq(artistFans.fanId, fanId)))
        .limit(1);
      if ((af?.spend ?? 0) < min) throw new ChallengeError("requirements_not_met", "Make an eligible purchase to complete this challenge.");
      return { lifetimeSpendCents: af?.spend ?? 0 };
    }
    case "manual":
    default:
      return { approvedByUserId: submission.approvedByUserId ?? null };
  }
}

/**
 * Complete a challenge for a fan: validates, records the completion,
 * awards reward points (idempotently) and emits the scoring event.
 */
export async function completeChallenge(
  input: { artistId: string; fanId: string; challengeId: string; submission?: ChallengeSubmission; actorUserId?: string | null },
  conn: Database = defaultDb,
) {
  return conn.transaction(async (tx) => {
    const [challenge] = await tx
      .select()
      .from(challenges)
      .where(and(eq(challenges.id, input.challengeId), eq(challenges.artistId, input.artistId)))
      .for("update");
    if (!challenge) throw new ChallengeError("not_found", "Challenge not found.");
    const now = new Date();
    if (challenge.status !== "active") throw new ChallengeError("not_active", "This challenge is not active.");
    if (challenge.startsAt && challenge.startsAt > now) throw new ChallengeError("not_started", "This challenge has not started yet.");
    if (challenge.endsAt && challenge.endsAt < now) throw new ChallengeError("ended", "This challenge has ended.");

    const [af] = await tx
      .select({ id: artistFans.id })
      .from(artistFans)
      .where(and(eq(artistFans.artistId, input.artistId), eq(artistFans.fanId, input.fanId)))
      .limit(1);
    if (!af) throw new ChallengeError("not_a_fan", "Join the fan club first.");

    const [existing] = await tx
      .select({ id: challengeCompletions.id })
      .from(challengeCompletions)
      .where(and(eq(challengeCompletions.challengeId, challenge.id), eq(challengeCompletions.fanId, input.fanId)))
      .limit(1);
    if (existing) throw new ChallengeError("already_completed", "You have already completed this challenge.");

    if (challenge.maxCompletions != null) {
      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(challengeCompletions)
        .where(eq(challengeCompletions.challengeId, challenge.id));
      if (count >= challenge.maxCompletions) throw new ChallengeError("full", "This challenge is full.");
    }

    const normalized = await validateSubmission(tx, challenge, input.fanId, input.submission ?? {});

    const [completion] = await tx
      .insert(challengeCompletions)
      .values({
        artistId: input.artistId,
        challengeId: challenge.id,
        fanId: input.fanId,
        submission: normalized,
        pointsAwarded: challenge.points,
      })
      .returning();

    if (challenge.points > 0) {
      await awardPoints(tx, {
        artistId: input.artistId,
        fanId: input.fanId,
        amount: challenge.points,
        type: "CHALLENGE",
        sourceId: completion.id,
        description: `Completed "${challenge.title}"`,
        actorUserId: input.actorUserId ?? null,
      });
    }

    const result = await ingestEvent(
      {
        artistId: input.artistId,
        fanId: input.fanId,
        source: "superfan",
        type: EVENT_TYPES.challengeCompleted,
        sourceEventId: `challenge_completion:${completion.id}`,
        verification: challenge.type === "manual" ? "artist_verified" : "verified",
        metadata: { challengeId: challenge.id, challengeTitle: challenge.title, isMajor: challenge.isMajor, points: challenge.points },
        summary: `Completed "${challenge.title}"`,
      },
      tx,
    );

    await track(tx, "challenge_completed", { artistId: input.artistId, fanId: input.fanId }, { challengeId: challenge.id, type: challenge.type });

    return { completion, challenge, ingest: result };
  });
}
