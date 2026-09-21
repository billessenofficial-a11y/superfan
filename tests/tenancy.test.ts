import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { challenges, fanEvents, fans, scoreLedger } from "@/db/schema";
import { completeChallenge } from "@/lib/challenges/complete";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { getFanDetail, listFans } from "@/lib/fans/queries";
import { resolveActor } from "@/lib/identity/resolver";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

describe("multi-tenancy", () => {
  it("artist A cannot read artist B's fan", async () => {
    const { artist: a } = await makeArtist();
    const { artist: b } = await makeArtist();
    const res = await ingestEvent({ artistId: b.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "o-b", email: uniqueEmail(), metadata: { amountCents: 5000 } }, db);

    expect(await getFanDetail(b.id, res.fanId!, db)).not.toBeNull();
    expect(await getFanDetail(a.id, res.fanId!, db)).toBeNull();

    const listA = await listFans(a.id, {}, db);
    expect(listA.rows.find((r) => r.fanId === res.fanId)).toBeUndefined();
    const listB = await listFans(b.id, {}, db);
    expect(listB.rows.find((r) => r.fanId === res.fanId)).toBeDefined();
  });

  it("the same person has independent scores per artist", async () => {
    const { artist: a } = await makeArtist();
    const { artist: b } = await makeArtist();
    const email = uniqueEmail();
    const ra = await ingestEvent({ artistId: a.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "o1", email, metadata: { amountCents: 10000 } }, db);
    const rb = await ingestEvent({ artistId: b.id, source: "superfan", type: EVENT_TYPES.fanJoined, email, metadata: {} }, db);
    expect(ra.fanId).toBe(rb.fanId); // one canonical fan
    expect(ra.score).toBe(350);
    expect(rb.score).toBe(100);
    const ledgerA = await db.select().from(scoreLedger).where(and(eq(scoreLedger.artistId, a.id), eq(scoreLedger.fanId, ra.fanId!)));
    const ledgerB = await db.select().from(scoreLedger).where(and(eq(scoreLedger.artistId, b.id), eq(scoreLedger.fanId, ra.fanId!)));
    expect(ledgerA.every((l) => l.artistId === a.id)).toBe(true);
    expect(ledgerB.every((l) => l.artistId === b.id)).toBe(true);
  });

  it("a challenge from artist B cannot be completed under artist A", async () => {
    const { artist: a } = await makeArtist();
    const { artist: b } = await makeArtist();
    const [challenge] = await db.insert(challenges).values({ artistId: b.id, title: "B only", status: "active", points: 100 }).returning();
    const fan = await resolveActor(db, { artistId: a.id, email: uniqueEmail(), source: "superfan" });
    await expect(completeChallenge({ artistId: a.id, fanId: fan.fanId, challengeId: challenge.id }, db)).rejects.toMatchObject({ code: "not_found" });
  });

  it("identical source event ids do not collide across artists", async () => {
    const { artist: a } = await makeArtist();
    const { artist: b } = await makeArtist();
    const ra = await ingestEvent({ artistId: a.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "order:1", email: uniqueEmail(), metadata: { amountCents: 100 } }, db);
    const rb = await ingestEvent({ artistId: b.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "order:1", email: uniqueEmail(), metadata: { amountCents: 100 } }, db);
    expect(ra.status).toBe("created");
    expect(rb.status).toBe("created");
    const rows = await db.select().from(fanEvents).where(eq(fanEvents.sourceEventId, "order:1"));
    expect(rows.filter((r) => [a.id, b.id].includes(r.artistId))).toHaveLength(2);
    const [fanA] = await db.select().from(fans).where(eq(fans.id, ra.fanId!));
    expect(fanA.mergedIntoFanId).toBeNull();
  });
});
