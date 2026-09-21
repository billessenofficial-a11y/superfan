import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { artistFans, claimTokens, fanIdentities, fans } from "@/db/schema";
import { claimIdentity, ClaimError, createClaimToken, previewClaim } from "@/lib/claims";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { resolveActor } from "@/lib/identity/resolver";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

async function unclaimedCommenter(artistId: string, username = "jamesmusic") {
  const res = await ingestEvent(
    {
      artistId,
      source: "instagram",
      type: EVENT_TYPES.instagramComment,
      sourceEventId: `c:${username}:${Math.random()}`,
      identity: { provider: "instagram", externalUserId: `ig_${username}_${Math.random().toString(36).slice(2, 6)}`, username },
      metadata: { text: "VIP please" },
    },
    db,
  );
  return { identityId: res.identityId!, shadowFanId: res.fanId!, score: res.score };
}

describe("identity claims", () => {
  it("an expired claim token fails", async () => {
    const { artist } = await makeArtist();
    const { identityId } = await unclaimedCommenter(artist.id);
    const { token } = await createClaimToken(db, { artistId: artist.id, identityId, ttlHours: -1 });
    const real = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    await expect(previewClaim(db, token)).rejects.toMatchObject({ code: "expired" });
    await expect(claimIdentity({ token, fanId: real.fanId }, db)).rejects.toMatchObject({ code: "expired" });
  });

  it("a claim token cannot be reused", async () => {
    const { artist } = await makeArtist();
    const { identityId } = await unclaimedCommenter(artist.id);
    const { token } = await createClaimToken(db, { artistId: artist.id, identityId });
    const real = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    const other = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    await claimIdentity({ token, fanId: real.fanId }, db);
    await expect(claimIdentity({ token, fanId: other.fanId }, db)).rejects.toMatchObject({ code: "used" });
    const [record] = await db.select().from(claimTokens).where(eq(claimTokens.identityId, identityId));
    expect(record.status).toBe("used");
    expect(record.claimedByFanId).toBe(real.fanId);
  });

  it("claiming moves the unclaimed activity onto the real fan", async () => {
    const { artist } = await makeArtist();
    const { identityId, shadowFanId, score } = await unclaimedCommenter(artist.id);
    expect(score).toBe(20);
    const { token } = await createClaimToken(db, { artistId: artist.id, identityId });

    // The real person already has some history under their email.
    const real = await ingestEvent({ artistId: artist.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "o-claim", email: uniqueEmail(), metadata: { amountCents: 1000 } }, db);
    expect(real.score).toBe(170);

    const result = await claimIdentity({ token, fanId: real.fanId! }, db);
    expect(result.merged).toBe(true);

    const [identity] = await db.select().from(fanIdentities).where(eq(fanIdentities.id, identityId));
    expect(identity.claimed).toBe(true);
    expect(identity.fanId).toBe(real.fanId);

    const [shadow] = await db.select().from(fans).where(eq(fans.id, shadowFanId));
    expect(shadow.mergedIntoFanId).toBe(real.fanId);

    const [af] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, real.fanId!)));
    expect(af.superfanScore).toBe(190); // 170 + 20 carried over
    expect(af.instagramInteractionsCount).toBe(1);
    const shadowMemberships = await db.select().from(artistFans).where(eq(artistFans.fanId, shadowFanId));
    expect(shadowMemberships).toHaveLength(0);
  });

  it("an identity already claimed by someone else cannot be claimed again", async () => {
    const { artist } = await makeArtist();
    const { identityId } = await unclaimedCommenter(artist.id);
    const a = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    const b = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    const t1 = await createClaimToken(db, { artistId: artist.id, identityId });
    await claimIdentity({ token: t1.token, fanId: a.fanId }, db);
    const t2 = await createClaimToken(db, { artistId: artist.id, identityId });
    await expect(claimIdentity({ token: t2.token, fanId: b.fanId }, db)).rejects.toBeInstanceOf(ClaimError);
  });
});
