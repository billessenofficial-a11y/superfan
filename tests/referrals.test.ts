import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { artistFans, fans, referrals } from "@/db/schema";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { resolveActor } from "@/lib/identity/resolver";
import { recordReferral, ReferralError, tryQualifyReferral } from "@/lib/referrals";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

async function newFan(artistId: string) {
  const actor = await resolveActor(db, { artistId, email: uniqueEmail(), source: "superfan" });
  await db.update(fans).set({ emailVerifiedAt: new Date() }).where(eq(fans.id, actor.fanId));
  const [af] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artistId), eq(artistFans.fanId, actor.fanId)));
  return { fanId: actor.fanId, code: af.referralCode };
}

describe("referrals", () => {
  it("a fan cannot refer themself", async () => {
    const { artist } = await makeArtist();
    const me = await newFan(artist.id);
    await expect(recordReferral(db, { artistId: artist.id, code: me.code, referredFanId: me.fanId })).rejects.toBeInstanceOf(ReferralError);
  });

  it("rejects unknown codes", async () => {
    const { artist } = await makeArtist();
    const me = await newFan(artist.id);
    await expect(recordReferral(db, { artistId: artist.id, code: "NOPE123", referredFanId: me.fanId })).rejects.toMatchObject({ code: "invalid_code" });
  });

  it("qualifies once and awards the referrer exactly once", async () => {
    const { artist } = await makeArtist();
    const referrer = await newFan(artist.id);
    const referred = await newFan(artist.id);

    const first = await recordReferral(db, { artistId: artist.id, code: referrer.code, referredFanId: referred.fanId });
    expect(first.created).toBe(true);
    const again = await recordReferral(db, { artistId: artist.id, code: referrer.code, referredFanId: referred.fanId });
    expect(again.created).toBe(false);

    // Not yet: no join / meaningful action.
    expect(await tryQualifyReferral({ artistId: artist.id, referredFanId: referred.fanId }, db)).toBeNull();

    await ingestEvent({ artistId: artist.id, fanId: referred.fanId, source: "superfan", type: EVENT_TYPES.fanJoined, sourceEventId: `join:${referred.fanId}`, metadata: {} }, db);
    await ingestEvent({ artistId: artist.id, fanId: referred.fanId, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "o-ref-1", metadata: { amountCents: 2000 } }, db);

    const qualified = await tryQualifyReferral({ artistId: artist.id, referredFanId: referred.fanId }, db);
    expect(qualified?.status).toBe("qualified");
    const second = await tryQualifyReferral({ artistId: artist.id, referredFanId: referred.fanId }, db);
    expect(second).toBeNull();

    const [ref] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, referrer.fanId)));
    expect(ref.rewardPointsCached).toBe(200);
    expect(ref.referralsCount).toBe(1);
    expect(ref.superfanScore).toBe(200); // referral.successful

    const rows = await db.select().from(referrals).where(eq(referrals.referredFanId, referred.fanId));
    expect(rows).toHaveLength(1);
  });

  it("a referred fan cannot be referred by a second person", async () => {
    const { artist } = await makeArtist();
    const a = await newFan(artist.id);
    const b = await newFan(artist.id);
    const referred = await newFan(artist.id);
    await recordReferral(db, { artistId: artist.id, code: a.code, referredFanId: referred.fanId });
    const res = await recordReferral(db, { artistId: artist.id, code: b.code, referredFanId: referred.fanId });
    expect(res.created).toBe(false);
    expect(res.referral.referrerFanId).toBe(a.fanId);
  });
});
