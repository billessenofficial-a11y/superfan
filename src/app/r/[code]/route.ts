import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { artistFans, artists } from "@/db/schema";
import { appUrl } from "@/lib/env";
import { clientKey, rateLimit } from "@/lib/ratelimit";

/**
 * Short referral link: /r/{code}. Resolves the code to its artist and
 * forwards to the join page with ?ref= preserved.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const limit = await rateLimit(clientKey(req.headers, "referral"), { limit: 60, windowSeconds: 60 });
  if (!limit.allowed) return new NextResponse("Too many requests", { status: 429 });
  const normalized = code.trim().toUpperCase().slice(0, 20);
  const [row] = await db
    .select({ slug: artists.slug })
    .from(artistFans)
    .innerJoin(artists, eq(artists.id, artistFans.artistId))
    .where(and(eq(artistFans.referralCode, normalized)))
    .limit(1);
  if (!row) return NextResponse.redirect(appUrl("/?ref=invalid"));
  return NextResponse.redirect(appUrl(`/artists/${row.slug}/join?ref=${normalized}`));
}
