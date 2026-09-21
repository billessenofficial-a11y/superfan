import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { artistMembers, artists, badges } from "@/db/schema";
import { ensureDefaultLevels, ensureDefaultRules, ensureSystemBadges } from "@/lib/scoring/engine";

export type CreateArtistInput = {
  name: string;
  slug: string;
  genre?: string | null;
  country?: string | null;
  accentColor?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  followerCount?: number;
  isDemo?: boolean;
  createdByUserId?: string | null;
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/**
 * Create an artist workspace with its default scoring rules, levels and
 * badges. If `createdByUserId` is set, that user becomes the owner.
 */
export async function createArtist(tx: DbOrTx, input: CreateArtistInput) {
  const [artist] = await tx
    .insert(artists)
    .values({
      name: input.name,
      slug: input.slug,
      genre: input.genre ?? null,
      country: input.country ?? null,
      accentColor: input.accentColor ?? "#8b5cf6",
      avatarUrl: input.avatarUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      bio: input.bio ?? null,
      followerCount: input.followerCount ?? 0,
      isDemo: input.isDemo ?? false,
      createdByUserId: input.createdByUserId ?? null,
    })
    .returning();

  await ensureDefaultRules(tx, artist.id);
  await ensureDefaultLevels(tx, artist.id);
  await ensureSystemBadges(tx);

  // "Day One" is artist-specific: fans who joined within the first 30 days.
  const dayOne = new Date(artist.createdAt);
  dayOne.setDate(dayOne.getDate() + 30);
  await tx
    .insert(badges)
    .values({
      artistId: artist.id,
      key: "day_one",
      name: "Day One",
      description: `Part of ${artist.name}'s fan club from the very beginning.`,
      icon: "sparkles",
      rarity: "rare",
      criteria: { kind: "member_before", date: dayOne.toISOString() },
      sortOrder: 100,
    })
    .onConflictDoNothing();

  if (input.createdByUserId) {
    await tx
      .insert(artistMembers)
      .values({
        artistId: artist.id,
        userId: input.createdByUserId,
        role: "owner",
        acceptedAt: new Date(),
      })
      .onConflictDoNothing();
  }

  return artist;
}

export async function getArtistBySlug(tx: DbOrTx, slug: string) {
  const [row] = await tx.select().from(artists).where(eq(artists.slug, slug)).limit(1);
  return row ?? null;
}

export async function getArtistById(tx: DbOrTx, id: string) {
  const [row] = await tx.select().from(artists).where(eq(artists.id, id)).limit(1);
  return row ?? null;
}
