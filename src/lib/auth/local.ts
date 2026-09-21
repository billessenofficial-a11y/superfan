import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { authMagicLinks, users } from "@/db/schema";
import { randomToken, sha256, signToken, verifyToken } from "@/lib/crypto";
import { appUrl, isProduction } from "@/lib/env";
import { magicLinkEmail, sendEmail } from "@/lib/email";

/**
 * Local development auth provider.
 *
 * Used only when Supabase is not configured. Implements the same
 * passwordless magic-link flow: the link is emailed via Resend when
 * available, otherwise printed to the server console. Sessions are a signed
 * HTTP-only cookie.
 */

export const LOCAL_SESSION_COOKIE = "sf_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const MAGIC_LINK_TTL_MINUTES = 15;

export type LocalSession = { uid: string; email: string; iat: number; exp: number };

export async function requestLocalMagicLink(input: { email: string; redirectTo?: string; artistName?: string }) {
  const email = input.email.trim().toLowerCase();
  const token = randomToken(24);
  await db.insert(authMagicLinks).values({
    email,
    tokenHash: sha256(token),
    redirectTo: input.redirectTo ?? null,
    expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60_000),
  });
  const url = appUrl(`/auth/verify?token=${token}`);
  const message = magicLinkEmail({ url, artistName: input.artistName });
  const result = await sendEmail({ to: email, ...message });
  return {
    email,
    delivered: result.delivered,
    // Only surface the link in non-production so the founder can demo without email.
    devLink: !isProduction ? url : undefined,
  };
}

export async function verifyLocalMagicLink(token: string) {
  const [link] = await db
    .select()
    .from(authMagicLinks)
    .where(and(eq(authMagicLinks.tokenHash, sha256(token)), isNull(authMagicLinks.usedAt), gt(authMagicLinks.expiresAt, new Date())))
    .limit(1);
  if (!link) return null;
  await db.update(authMagicLinks).set({ usedAt: new Date() }).where(eq(authMagicLinks.id, link.id));
  const user = await upsertUserByEmail(link.email);
  return { user, redirectTo: link.redirectTo };
}

export async function upsertUserByEmail(email: string, displayName?: string) {
  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${normalized}`)
    .limit(1);
  if (existing) {
    const [updated] = await db
      .update(users)
      .set({ lastSignInAt: new Date(), displayName: existing.displayName ?? displayName ?? null })
      .where(eq(users.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(users)
    .values({ email: normalized, displayName: displayName ?? null, lastSignInAt: new Date() })
    .returning();
  return created;
}

export function createLocalSessionToken(user: { id: string; email: string }): string {
  const now = Math.floor(Date.now() / 1000);
  return signToken({ uid: user.id, email: user.email, iat: now, exp: now + SESSION_TTL_SECONDS } satisfies LocalSession);
}

export function readLocalSession(cookieValue: string | undefined): LocalSession | null {
  if (!cookieValue) return null;
  const result = verifyToken<LocalSession>(cookieValue);
  return result.ok ? result.payload : null;
}

export const localSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProduction,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
