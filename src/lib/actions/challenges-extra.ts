"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { challengeCompletions, fans } from "@/db/schema";
import { requireArtistAccess } from "@/lib/auth/context";
import { act } from "./result";

/** Fans who completed a challenge, newest first (for the completions drawer). */
export async function listChallengeCompletionsAction(input: { challengeId: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("viewFans");
    const challengeId = z.string().uuid().parse(input.challengeId);
    return db
      .select({
        id: challengeCompletions.id,
        fanId: challengeCompletions.fanId,
        firstName: fans.firstName,
        lastName: fans.lastName,
        email: fans.email,
        avatarUrl: fans.avatarUrl,
        pointsAwarded: challengeCompletions.pointsAwarded,
        completedAt: challengeCompletions.completedAt,
      })
      .from(challengeCompletions)
      .innerJoin(fans, eq(fans.id, challengeCompletions.fanId))
      .where(and(eq(challengeCompletions.artistId, ctx.artist.id), eq(challengeCompletions.challengeId, challengeId)))
      .orderBy(desc(challengeCompletions.completedAt))
      .limit(500);
  });
}
