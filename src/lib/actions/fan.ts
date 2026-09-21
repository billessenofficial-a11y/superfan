"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { artistFans, fanEvents, fanIdentities, fans, rewardPointTransactions, scoreLedger } from "@/db/schema";
import { getArtistById, getArtistBySlug } from "@/lib/artists/create";
import { track } from "@/lib/audit";
import { requireFanContext } from "@/lib/auth/context";
import { signOut } from "@/lib/auth/session";
import { completeChallenge, type ChallengeSubmission } from "@/lib/challenges/complete";
import { checkInFan } from "@/lib/checkins";
import { claimIdentity } from "@/lib/claims";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { ensureArtistFan } from "@/lib/identity/resolver";
import { recordReferral, tryQualifyReferral } from "@/lib/referrals";
import { redeemReward } from "@/lib/rewards/redeem";
import { act } from "./result";

const PRIVACY_POLICY_VERSION = "2026-09";

async function artistOr404(slug: string) {
  const artist = await getArtistBySlug(db, slug);
  if (!artist) throw Object.assign(new Error("Artist not found."), { code: "not_found" });
  return artist;
}

/** Join an artist's fan club (idempotent). Records the referral when a code is present. */
export async function joinArtistAction(input: { slug: string; ref?: string | null }) {
  const { slug, ref } = z.object({ slug: z.string().min(1), ref: z.string().max(20).nullable().optional() }).parse(input);
  const { fan } = await requireFanContext(`/artists/${slug}/join${ref ? `?ref=${ref}` : ""}`);
  const artist = await artistOr404(slug);

  await db.transaction(async (tx) => {
    const { row, created } = await ensureArtistFan(tx, artist.id, fan.id, { firstSource: "superfan" });
    if (ref) {
      try {
        await recordReferral(tx, { artistId: artist.id, code: ref, referredFanId: fan.id });
      } catch {
        // invalid / self referral: ignore silently; joining still succeeds
      }
    }
    await tx.update(fans).set({ consentedAt: fan.consentedAt ?? new Date(), privacyPolicyVersion: PRIVACY_POLICY_VERSION }).where(eq(fans.id, fan.id));
    // A fan who left earlier gets a fresh join event (the first one is deduped by id).
    const [left] = row.joinedAt
      ? []
      : await tx
          .select({ id: fanEvents.id })
          .from(fanEvents)
          .where(and(eq(fanEvents.artistId, artist.id), eq(fanEvents.fanId, fan.id), eq(fanEvents.type, EVENT_TYPES.fanLeft)))
          .limit(1);
    const rejoining = Boolean(left);
    const res = await ingestEvent(
      {
        artistId: artist.id,
        fanId: fan.id,
        source: "superfan",
        type: EVENT_TYPES.fanJoined,
        sourceEventId: rejoining ? `rejoin:${fan.id}:${Date.now()}` : `join:${fan.id}`,
        metadata: { via: ref ? "referral" : "direct", rejoined: rejoining },
        summary: rejoining ? "Rejoined the fan club" : "Joined the fan club",
      },
      tx,
    );
    // Membership is what the passport checks; make sure it is set even when the join event was deduped.
    await tx
      .update(artistFans)
      .set({ joinedAt: sql`coalesce(${artistFans.joinedAt}, now())` })
      .where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, fan.id)));
    if (res.status === "created" || created) await track(tx, "fan_joined", { artistId: artist.id, fanId: fan.id }, { via: ref ? "referral" : "direct", rejoined: rejoining });
  });
  redirect(`/fan/${slug}?welcome=1`);
}

/**
 * Leave an artist's fan club. The membership row, score, points and history
 * are kept (they are the fan's record); only `joined_at` is cleared so the
 * passport closes and communications stop. Rejoining restores everything.
 */
export async function leaveArtistAction(input: { slug: string }) {
  return act(async () => {
    const { slug } = z.object({ slug: z.string().min(1) }).parse(input);
    const { fan } = await requireFanContext(`/fan/${slug}`);
    const artist = await artistOr404(slug);
    await db.transaction(async (tx) => {
      const [membership] = await tx
        .select({ joinedAt: artistFans.joinedAt })
        .from(artistFans)
        .where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, fan.id)))
        .limit(1);
      if (!membership?.joinedAt) throw Object.assign(new Error("You are not a member of this fan club."), { code: "not_member" });
      await tx.update(artistFans).set({ joinedAt: null }).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, fan.id)));
      await ingestEvent(
        { artistId: artist.id, fanId: fan.id, source: "superfan", type: EVENT_TYPES.fanLeft, sourceEventId: `leave:${fan.id}:${Date.now()}`, metadata: {}, summary: "Left the fan club" },
        tx,
      );
      await track(tx, "fan_left", { artistId: artist.id, fanId: fan.id });
    });
    revalidatePath("/fan", "layout");
    return { artistName: artist.name };
  });
}

export async function completeChallengeAction(input: { slug: string; challengeId: string; submission?: ChallengeSubmission }) {
  return act(async () => {
    const { fan } = await requireFanContext();
    const artist = await artistOr404(input.slug);
    const challengeId = z.string().uuid().parse(input.challengeId);
    const res = await completeChallenge({ artistId: artist.id, fanId: fan.id, challengeId, submission: input.submission });
    await tryQualifyReferral({ artistId: artist.id, referredFanId: fan.id });
    revalidatePath(`/fan/${input.slug}`, "layout");
    return { points: res.challenge.points, scoreDelta: res.ingest.scoreDelta, levelUp: res.ingest.levelUp, levelName: res.ingest.levelName, newBadges: res.ingest.newBadges.map((b) => b.name) };
  });
}

export async function redeemRewardAction(input: { slug: string; rewardId: string }) {
  return act(async () => {
    const { fan } = await requireFanContext();
    const artist = await artistOr404(input.slug);
    const rewardId = z.string().uuid().parse(input.rewardId);
    const res = await redeemReward({ artistId: artist.id, fanId: fan.id, rewardId });
    revalidatePath(`/fan/${input.slug}`, "layout");
    return { rewardName: res.reward.name, status: res.redemption.status, fulfillmentType: res.reward.fulfillmentType };
  });
}

export async function claimIdentityAction(input: { token: string }) {
  return act(async () => {
    const { fan } = await requireFanContext(`/claim/${input.token}`);
    const res = await claimIdentity({ token: input.token, fanId: fan.id });
    const artist = await getArtistById(db, res.artistId);
    await tryQualifyReferral({ artistId: res.artistId, referredFanId: fan.id });
    revalidatePath("/fan", "layout");
    return { slug: artist?.slug ?? null, merged: res.merged };
  });
}

export async function checkInAction(input: { token: string }) {
  return act(async () => {
    const { fan } = await requireFanContext(`/checkin/${input.token}`);
    const res = await checkInFan({ token: input.token, fanId: fan.id, method: "qr" });
    await tryQualifyReferral({ artistId: res.event.artistId, referredFanId: fan.id });
    const artist = await getArtistById(db, res.event.artistId);
    revalidatePath("/fan", "layout");
    return { eventName: res.event.name, points: res.event.checkinPoints, scoreDelta: res.ingest.scoreDelta, levelUp: res.ingest.levelUp, levelName: res.ingest.levelName, newBadges: res.ingest.newBadges.map((b) => b.name), slug: artist?.slug ?? null };
  });
}

const profileSchema = z.object({
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  communicationPreferences: z.object({ email: z.boolean(), sms: z.boolean() }).optional(),
});

export async function updateFanProfileAction(input: z.input<typeof profileSchema>) {
  return act(async () => {
    const { fan } = await requireFanContext();
    const data = profileSchema.parse(input);
    await db.update(fans).set({ ...data, firstName: data.firstName || null, lastName: data.lastName || null, city: data.city || null, country: data.country || null }).where(eq(fans.id, fan.id));
    revalidatePath("/fan", "layout");
  });
}

/** Unlink an external identity from the fan's account (history stays attributed). */
export async function disconnectIdentityAction(input: { identityId: string }) {
  return act(async () => {
    const { fan } = await requireFanContext();
    const [identity] = await db.select().from(fanIdentities).where(and(eq(fanIdentities.id, input.identityId), eq(fanIdentities.fanId, fan.id))).limit(1);
    if (!identity || identity.provider === "email") throw Object.assign(new Error("This identity cannot be disconnected."), { code: "forbidden" });
    await db.update(fanIdentities).set({ claimed: false, metadata: { ...identity.metadata, disconnectedAt: new Date().toISOString(), accessTokenEncrypted: undefined, refreshTokenEncrypted: undefined } }).where(eq(fanIdentities.id, identity.id));
    revalidatePath("/fan/settings");
  });
}

/** Full export of the fan's data (GDPR-style). */
export async function exportMyDataAction() {
  return act(async () => {
    const { fan } = await requireFanContext();
    const [memberships, identities, events, ledger, points] = await Promise.all([
      db.select().from(artistFans).where(eq(artistFans.fanId, fan.id)),
      db.select({ provider: fanIdentities.provider, username: fanIdentities.username, claimed: fanIdentities.claimed, createdAt: fanIdentities.createdAt }).from(fanIdentities).where(eq(fanIdentities.fanId, fan.id)),
      db.select({ artistId: fanEvents.artistId, type: fanEvents.type, source: fanEvents.source, occurredAt: fanEvents.occurredAt, summary: fanEvents.summary, metadata: fanEvents.metadata }).from(fanEvents).where(eq(fanEvents.fanId, fan.id)),
      db.select({ artistId: scoreLedger.artistId, dimension: scoreLedger.dimension, points: scoreLedger.points, reason: scoreLedger.reason, occurredAt: scoreLedger.occurredAt }).from(scoreLedger).where(eq(scoreLedger.fanId, fan.id)),
      db.select({ artistId: rewardPointTransactions.artistId, amount: rewardPointTransactions.amount, type: rewardPointTransactions.transactionType, description: rewardPointTransactions.description, createdAt: rewardPointTransactions.createdAt }).from(rewardPointTransactions).where(eq(rewardPointTransactions.fanId, fan.id)),
    ]);
    const { userId: _u, mergedIntoFanId: _m, ...profile } = fan;
    return { json: JSON.stringify({ exportedAt: new Date().toISOString(), profile, memberships, identities, events, scoreLedger: ledger, rewardPoints: points }, null, 2) };
  });
}

/** Delete the fan account: anonymize the record and revoke access. */
export async function deleteAccountAction() {
  const { fan } = await requireFanContext();
  await db.transaction(async (tx) => {
    await tx.update(fanIdentities).set({ claimed: false, fanId: null, username: null, displayName: null, avatarUrl: null, metadata: {} }).where(and(eq(fanIdentities.fanId, fan.id), eq(fanIdentities.provider, "email")));
    await tx.update(fanIdentities).set({ claimed: false, metadata: {} }).where(eq(fanIdentities.fanId, fan.id));
    await tx
      .update(fans)
      .set({ email: null, phone: null, firstName: null, lastName: null, avatarUrl: null, city: null, region: null, country: null, userId: null, deletedAt: new Date(), communicationPreferences: { email: false, sms: false } })
      .where(eq(fans.id, fan.id));
  });
  await signOut();
  redirect("/?deleted=1");
}
