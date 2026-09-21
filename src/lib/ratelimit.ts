import { sql } from "drizzle-orm";
import { db as defaultDb, type DbOrTx } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimitResult = { allowed: boolean; remaining: number; resetAt: Date };

/**
 * Fixed-window rate limiter backed by Postgres so it works across serverless
 * instances without extra infrastructure. Good enough for public
 * claim / check-in / referral endpoints at MVP scale.
 */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowSeconds: number },
  conn: DbOrTx = defaultDb,
): Promise<RateLimitResult> {
  const now = new Date();
  const [row] = await conn
    .insert(rateLimits)
    .values({ key, count: 1, windowStartedAt: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`case when ${rateLimits.windowStartedAt} < now() - make_interval(secs => ${opts.windowSeconds}) then 1 else ${rateLimits.count} + 1 end`,
        windowStartedAt: sql`case when ${rateLimits.windowStartedAt} < now() - make_interval(secs => ${opts.windowSeconds}) then now() else ${rateLimits.windowStartedAt} end`,
      },
    })
    .returning();

  const resetAt = new Date(row.windowStartedAt.getTime() + opts.windowSeconds * 1000);
  return {
    allowed: row.count <= opts.limit,
    remaining: Math.max(0, opts.limit - row.count),
    resetAt,
  };
}

export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
  return `${scope}:${ip}`;
}
