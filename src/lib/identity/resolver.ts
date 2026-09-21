import { and, eq, isNull, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db";
import { artistFans, fanIdentities, fans } from "@/db/schema";
import { randomCode } from "@/lib/crypto";
import { ARTIST_SCOPED_PROVIDERS, type IdentityProvider } from "@/lib/events/types";

export type IdentityInput = {
  provider: IdentityProvider;
  externalUserId: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  verified?: boolean;
  metadata?: Record<string, unknown>;
};

export type ProfileHints = {
  firstName?: string;
  lastName?: string;
  city?: string;
  region?: string;
  country?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/** Follow merge pointers to the surviving canonical fan. */
export async function canonicalFanId(tx: DbOrTx, fanId: string): Promise<string> {
  let current = fanId;
  for (let i = 0; i < 10; i++) {
    const [row] = await tx
      .select({ mergedInto: fans.mergedIntoFanId })
      .from(fans)
      .where(eq(fans.id, current))
      .limit(1);
    if (!row?.mergedInto) return current;
    current = row.mergedInto;
  }
  return current;
}

export async function findFanByEmail(tx: DbOrTx, email: string) {
  const [row] = await tx
    .select()
    .from(fans)
    .where(and(sql`lower(${fans.email}) = ${normalizeEmail(email)}`, isNull(fans.mergedIntoFanId)))
    .limit(1);
  return row ?? null;
}

export async function findFanByPhone(tx: DbOrTx, phone: string) {
  const [row] = await tx
    .select()
    .from(fans)
    .where(and(eq(fans.phone, normalizePhone(phone)), isNull(fans.mergedIntoFanId)))
    .limit(1);
  return row ?? null;
}

export async function createFan(
  tx: DbOrTx,
  hints: ProfileHints & { emailVerified?: boolean; userId?: string },
) {
  const [row] = await tx
    .insert(fans)
    .values({
      email: hints.email ? normalizeEmail(hints.email) : null,
      emailVerifiedAt: hints.email && hints.emailVerified ? new Date() : null,
      phone: hints.phone ? normalizePhone(hints.phone) : null,
      firstName: hints.firstName ?? null,
      lastName: hints.lastName ?? null,
      city: hints.city ?? null,
      region: hints.region ?? null,
      country: hints.country ?? null,
      avatarUrl: hints.avatarUrl ?? null,
      userId: hints.userId ?? null,
    })
    .returning();
  return row;
}

/** Fill in missing profile fields without overwriting existing values. */
export async function enrichFanProfile(tx: DbOrTx, fanId: string, hints: ProfileHints) {
  const updates: Record<string, unknown> = {};
  if (hints.firstName) updates.firstName = sql`coalesce(${fans.firstName}, ${hints.firstName})`;
  if (hints.lastName) updates.lastName = sql`coalesce(${fans.lastName}, ${hints.lastName})`;
  if (hints.city) updates.city = sql`coalesce(${fans.city}, ${hints.city})`;
  if (hints.region) updates.region = sql`coalesce(${fans.region}, ${hints.region})`;
  if (hints.country) updates.country = sql`coalesce(${fans.country}, ${hints.country})`;
  if (hints.avatarUrl) updates.avatarUrl = sql`coalesce(${fans.avatarUrl}, ${hints.avatarUrl})`;
  if (hints.phone) updates.phone = sql`coalesce(${fans.phone}, ${normalizePhone(hints.phone)})`;
  if (hints.email) updates.email = sql`coalesce(${fans.email}, ${normalizeEmail(hints.email)})`;
  if (Object.keys(updates).length === 0) return;
  await tx.update(fans).set(updates).where(eq(fans.id, fanId));
}

export async function generateReferralCode(tx: DbOrTx, artistId: string): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomCode(7);
    const [existing] = await tx
      .select({ id: artistFans.id })
      .from(artistFans)
      .where(and(eq(artistFans.artistId, artistId), eq(artistFans.referralCode, code)))
      .limit(1);
    if (!existing) return code;
  }
  return randomCode(10);
}

/**
 * Ensure an artist_fans relationship exists. Returns the row and whether it
 * was newly created.
 */
export async function ensureArtistFan(
  tx: DbOrTx,
  artistId: string,
  fanId: string,
  opts: { firstSeenAt?: Date; firstSource?: typeof artistFans.$inferInsert.firstSource } = {},
) {
  const [existing] = await tx
    .select()
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)))
    .limit(1);
  if (existing) return { row: existing, created: false };

  const referralCode = await generateReferralCode(tx, artistId);
  const [row] = await tx
    .insert(artistFans)
    .values({
      artistId,
      fanId,
      referralCode,
      firstSeenAt: opts.firstSeenAt ?? new Date(),
      firstSource: opts.firstSource ?? null,
    })
    .onConflictDoNothing()
    .returning();
  if (row) return { row, created: true };
  const [raced] = await tx
    .select()
    .from(artistFans)
    .where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, fanId)))
    .limit(1);
  return { row: raced, created: false };
}

function identityScope(provider: IdentityProvider, artistId: string) {
  return ARTIST_SCOPED_PROVIDERS.has(provider) ? artistId : null;
}

/** Upsert an external identity, returning the row (with fanId if already linked). */
export async function upsertIdentity(tx: DbOrTx, artistId: string, identity: IdentityInput) {
  const scope = identityScope(identity.provider, artistId);
  const scopeExpr = scope
    ? sql`${fanIdentities.artistId} = ${scope}`
    : sql`${fanIdentities.artistId} is null`;

  const [existing] = await tx
    .select()
    .from(fanIdentities)
    .where(
      and(
        eq(fanIdentities.provider, identity.provider),
        eq(fanIdentities.externalUserId, identity.externalUserId),
        scopeExpr,
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await tx
      .update(fanIdentities)
      .set({
        username: identity.username ?? existing.username,
        displayName: identity.displayName ?? existing.displayName,
        avatarUrl: identity.avatarUrl ?? existing.avatarUrl,
        lastSeenAt: new Date(),
        metadata: { ...existing.metadata, ...(identity.metadata ?? {}) },
      })
      .where(eq(fanIdentities.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await tx
    .insert(fanIdentities)
    .values({
      artistId: scope,
      provider: identity.provider,
      externalUserId: identity.externalUserId,
      username: identity.username ?? null,
      displayName: identity.displayName ?? null,
      avatarUrl: identity.avatarUrl ?? null,
      verified: identity.verified ?? true,
      metadata: identity.metadata ?? {},
      lastSeenAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await tx
    .select()
    .from(fanIdentities)
    .where(
      and(
        eq(fanIdentities.provider, identity.provider),
        eq(fanIdentities.externalUserId, identity.externalUserId),
        scopeExpr,
      ),
    )
    .limit(1);
  return raced;
}

export type ResolveInput = {
  artistId: string;
  fanId?: string;
  email?: string;
  phone?: string;
  identity?: IdentityInput;
  profile?: ProfileHints;
  /** Where this fan was first seen, for artist_fans.first_source. */
  source?: typeof artistFans.$inferInsert.firstSource;
  occurredAt?: Date;
};

export type ResolvedActor = {
  fanId: string;
  identityId: string | null;
  artistFanCreated: boolean;
  fanCreated: boolean;
  /** True when we created a shadow fan for an unclaimed identity. */
  shadow: boolean;
};

/**
 * Resolve the acting fan for an event using the safe matching priority:
 *   1. explicit fan id
 *   2. verified email
 *   3. verified phone
 *   4. provider-stable external account id (already linked)
 *   5. otherwise: a shadow fan attached to the identity, to be claimed later
 *
 * Never merges based on names, usernames or fuzzy similarity.
 */
export async function resolveActor(tx: DbOrTx, input: ResolveInput): Promise<ResolvedActor> {
  let fanId: string | null = null;
  let fanCreated = false;
  let shadow = false;
  let identityRow: typeof fanIdentities.$inferSelect | null = null;

  if (input.identity) {
    identityRow = await upsertIdentity(tx, input.artistId, input.identity);
    if (identityRow.fanId) fanId = await canonicalFanId(tx, identityRow.fanId);
  }

  if (input.fanId) {
    fanId = await canonicalFanId(tx, input.fanId);
  }

  if (!fanId && input.email) {
    const byEmail = await findFanByEmail(tx, input.email);
    if (byEmail) fanId = byEmail.id;
  }

  if (!fanId && input.phone) {
    const byPhone = await findFanByPhone(tx, input.phone);
    if (byPhone) fanId = byPhone.id;
  }

  if (!fanId) {
    // Create a fan. If we only know an external identity this is a "shadow"
    // fan that a real person can claim later.
    const created = await createFan(tx, {
      ...input.profile,
      email: input.email,
      phone: input.phone,
      firstName: input.profile?.firstName ?? input.identity?.displayName?.split(" ")[0],
      lastName:
        input.profile?.lastName ?? (input.identity?.displayName?.split(" ").slice(1).join(" ") || undefined),
      avatarUrl: input.profile?.avatarUrl ?? input.identity?.avatarUrl,
    });
    fanId = created.id;
    fanCreated = true;
    shadow = !input.email && !input.phone && Boolean(input.identity);
  } else if (input.profile || input.email || input.phone) {
    await enrichFanProfile(tx, fanId, { ...input.profile, email: input.email, phone: input.phone });
  }

  // Link the identity to the fan if it is not linked yet. A shadow fan is
  // "claimed: false" until the real person claims it.
  if (identityRow && identityRow.fanId !== fanId) {
    await tx
      .update(fanIdentities)
      .set({
        fanId,
        claimed: identityRow.claimed || !shadow,
        claimedAt: identityRow.claimedAt ?? (!shadow ? new Date() : null),
      })
      .where(eq(fanIdentities.id, identityRow.id));
  }

  // Make sure the email identity exists for CRM display purposes.
  if (input.email) {
    await upsertEmailIdentity(tx, fanId, input.email, Boolean(input.identity?.verified ?? true));
  }

  const { created: artistFanCreated } = await ensureArtistFan(tx, input.artistId, fanId, {
    firstSeenAt: input.occurredAt,
    firstSource: input.source,
  });

  return {
    fanId,
    identityId: identityRow?.id ?? null,
    artistFanCreated,
    fanCreated,
    shadow,
  };
}

export async function upsertEmailIdentity(tx: DbOrTx, fanId: string, email: string, verified: boolean) {
  const normalized = normalizeEmail(email);
  await tx
    .insert(fanIdentities)
    .values({
      artistId: null,
      fanId,
      provider: "email",
      externalUserId: normalized,
      username: normalized,
      claimed: true,
      claimedAt: new Date(),
      verified,
      lastSeenAt: new Date(),
    })
    .onConflictDoNothing();
}
