import { and, eq, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { artistMembers, artists, fans } from "@/db/schema";
import { findFanByEmail } from "@/lib/identity/resolver";
import { getSessionUser, type SessionUser } from "./session";

export type MemberRole = typeof artistMembers.$inferSelect.role;
export type Artist = typeof artists.$inferSelect;

export const ARTIST_COOKIE = "sf_artist";

export class AuthError extends Error {
  constructor(
    public readonly code: "unauthenticated" | "forbidden" | "no_artist",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const ROLE_RANK: Record<MemberRole, number> = { viewer: 0, community: 1, marketing: 2, admin: 3, owner: 4 };

export function roleAtLeast(role: MemberRole, required: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** Permission matrix for team roles. */
export const PERMISSIONS = {
  viewFans: "viewer",
  exportFans: "marketing",
  editFans: "community",
  manageRewards: "marketing",
  manageChallenges: "community",
  manageEvents: "marketing",
  manageCampaigns: "marketing",
  manageSegments: "marketing",
  manageIntegrations: "admin",
  manageScoring: "admin",
  manageTeam: "admin",
  manageArtist: "admin",
  importFans: "marketing",
  adjustPoints: "admin",
} as const satisfies Record<string, MemberRole>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: MemberRole, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSIONS[permission]);
}

/* ───────────────────────── User ───────────────────────── */

export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return user;
}

/* ───────────────────────── Artist workspace ───────────────────────── */

export type ArtistContext = {
  user: SessionUser;
  artist: Artist;
  role: MemberRole;
  memberships: { artistId: string; role: MemberRole; artist: Pick<Artist, "id" | "name" | "slug" | "avatarUrl"> }[];
};

export const listMemberships = cache(async (userId: string) => {
  const rows = await db
    .select({
      artistId: artistMembers.artistId,
      role: artistMembers.role,
      artist: { id: artists.id, name: artists.name, slug: artists.slug, avatarUrl: artists.avatarUrl },
    })
    .from(artistMembers)
    .innerJoin(artists, eq(artists.id, artistMembers.artistId))
    .where(eq(artistMembers.userId, userId))
    .orderBy(artists.name);
  return rows;
});

/**
 * Resolve the active artist workspace for the signed-in user. The artist id
 * is never trusted from the client: it comes from the user's memberships,
 * with the `sf_artist` cookie only used to pick among them.
 */
export const getArtistContext = cache(async (): Promise<ArtistContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const memberships = await listMemberships(user.id);
  if (memberships.length === 0) return null;

  const cookieStore = await cookies();
  const preferred = cookieStore.get(ARTIST_COOKIE)?.value;
  const membership = memberships.find((m) => m.artistId === preferred) ?? memberships[0];

  const [artist] = await db.select().from(artists).where(eq(artists.id, membership.artistId)).limit(1);
  if (!artist) return null;
  return { user, artist, role: membership.role, memberships };
});

/** Redirects to login / onboarding as needed. Use in server components and actions. */
export async function requireArtistContext(permission?: Permission): Promise<ArtistContext> {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/app");
  const ctx = await getArtistContext();
  if (!ctx) redirect("/onboarding");
  if (permission && !can(ctx.role, permission)) {
    throw new AuthError("forbidden", "You do not have permission to do that.");
  }
  return ctx;
}

/** Throwing variant for API routes and server actions (no redirects). */
export async function requireArtistAccess(permission?: Permission): Promise<ArtistContext> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("unauthenticated", "Sign in required.");
  const ctx = await getArtistContext();
  if (!ctx) throw new AuthError("no_artist", "No artist workspace.");
  if (permission && !can(ctx.role, permission)) throw new AuthError("forbidden", "You do not have permission to do that.");
  return ctx;
}

/* ───────────────────────── Fan ───────────────────────── */

export type FanContext = {
  user: SessionUser;
  fan: typeof fans.$inferSelect;
};

/**
 * The canonical fan record for the signed-in user. Created on first access
 * and linked by verified email (the magic link proves ownership).
 */
export const getFanContext = cache(async (): Promise<FanContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const [byUser] = await db.select().from(fans).where(and(eq(fans.userId, user.id), isNull(fans.mergedIntoFanId))).limit(1);
  if (byUser) return { user, fan: byUser };

  // Adopt an existing fan record with this verified email (e.g. from a CSV
  // import or Shopify order) so their history is waiting for them.
  const existing = await findFanByEmail(db, user.email);
  if (existing && !existing.userId) {
    const [linked] = await db
      .update(fans)
      .set({ userId: user.id, emailVerifiedAt: existing.emailVerifiedAt ?? new Date() })
      .where(eq(fans.id, existing.id))
      .returning();
    return { user, fan: linked };
  }

  const [created] = await db
    .insert(fans)
    .values({
      userId: user.id,
      email: user.email,
      emailVerifiedAt: new Date(),
      firstName: user.displayName?.split(" ")[0] ?? null,
      avatarUrl: user.avatarUrl,
    })
    .returning();
  return { user, fan: created };
});

export async function requireFanContext(next?: string): Promise<FanContext> {
  const ctx = await getFanContext();
  if (!ctx) redirect(`/login?mode=fan${next ? `&next=${encodeURIComponent(next)}` : ""}`);
  return ctx;
}
