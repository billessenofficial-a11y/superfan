"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { artistFans, fans } from "@/db/schema";
import { requireArtistAccess } from "@/lib/auth/context";
import { act } from "./result";

/** Look up one of the artist's fans by email for staff check-in at the door. */
export async function findFanByEmailAction(input: { email: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageEvents");
    const email = z.string().email("Enter a valid email address").parse(input.email.trim().toLowerCase());
    const [row] = await db
      .select({
        id: fans.id,
        firstName: fans.firstName,
        lastName: fans.lastName,
        email: fans.email,
        avatarUrl: fans.avatarUrl,
        city: fans.city,
        superfanScore: artistFans.superfanScore,
        eventsAttendedCount: artistFans.eventsAttendedCount,
      })
      .from(fans)
      .innerJoin(artistFans, and(eq(artistFans.fanId, fans.id), eq(artistFans.artistId, ctx.artist.id)))
      .where(and(sql`lower(${fans.email}) = ${email}`, isNull(fans.mergedIntoFanId), isNull(fans.deletedAt)))
      .limit(1);
    return row ?? null;
  });
}
