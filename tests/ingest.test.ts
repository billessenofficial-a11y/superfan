import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { artistFans, fanEvents, fanIdentities, fans, scoreLedger } from "@/db/schema";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

describe("event ingestion", () => {
  it("is idempotent: the same Shopify webhook twice produces one order event", async () => {
    const { artist } = await makeArtist();
    const email = uniqueEmail();
    const input = {
      artistId: artist.id,
      source: "shopify" as const,
      type: EVENT_TYPES.shopifyOrderCreated,
      sourceEventId: "order:1001",
      email,
      identity: { provider: "shopify" as const, externalUserId: "cust_1", username: email },
      metadata: { amountCents: 8500, orderId: "1001" },
      summary: "Purchased Tour Hoodie",
    };

    const first = await ingestEvent(input, db);
    const second = await ingestEvent(input, db);

    expect(first.status).toBe("created");
    expect(second.status).toBe("duplicate");
    expect(second.eventId).toBe(first.eventId);

    const events = await db
      .select()
      .from(fanEvents)
      .where(and(eq(fanEvents.artistId, artist.id), eq(fanEvents.type, EVENT_TYPES.shopifyOrderCreated)));
    expect(events).toHaveLength(1);

    const [af] = await db
      .select()
      .from(artistFans)
      .where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, first.fanId!)));
    expect(af.ordersCount).toBe(1);
    expect(af.lifetimeSpendCents).toBe(8500);
  });

  it("generates a deterministic id when the provider gives none", async () => {
    const { artist } = await makeArtist();
    const occurredAt = new Date("2026-09-01T10:00:00Z");
    const input = {
      artistId: artist.id,
      source: "instagram" as const,
      type: EVENT_TYPES.instagramComment,
      occurredAt,
      identity: { provider: "instagram" as const, externalUserId: "ig_42", username: "jamesmusic" },
      metadata: { text: "THIS ALBUM 🔥", objectId: "media_9" },
    };
    const a = await ingestEvent(input, db);
    const b = await ingestEvent(input, db);
    expect(a.status).toBe("created");
    expect(b.status).toBe("duplicate");
  });

  it("scores a first purchase correctly (first purchase + per-dollar)", async () => {
    const { artist } = await makeArtist();
    const res = await ingestEvent(
      {
        artistId: artist.id,
        source: "shopify",
        type: EVENT_TYPES.shopifyOrderCreated,
        sourceEventId: "order:2001",
        email: uniqueEmail(),
        metadata: { amountCents: 8500 },
      },
      db,
    );
    // 150 (first purchase) + 85 * 2 (per dollar) = 320
    expect(res.score).toBe(320);
    expect(res.pointsAwarded).toBe(85); // 1 reward point per $1
    const keys = res.ledger.map((l) => l.ruleKey).sort();
    expect(keys).toEqual(["merch.first_purchase", "merch.per_dollar"]);
  });

  it("scores a repeat purchase with the repeat rule instead of the first-purchase rule", async () => {
    const { artist } = await makeArtist();
    const email = uniqueEmail();
    await ingestEvent(
      { artistId: artist.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "o1", email, metadata: { amountCents: 1000 } },
      db,
    );
    const second = await ingestEvent(
      { artistId: artist.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "o2", email, metadata: { amountCents: 2000 } },
      db,
    );
    const keys = second.ledger.map((l) => l.ruleKey).sort();
    expect(keys).toEqual(["merch.per_dollar", "merch.repeat_purchase"]);
    // 150 + 20 + 75 + 40 = 285
    expect(second.score).toBe(285);
  });

  it("reverses score on a full refund", async () => {
    const { artist } = await makeArtist();
    const email = uniqueEmail();
    const order = await ingestEvent(
      { artistId: artist.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "order:3001", email, metadata: { amountCents: 5000 } },
      db,
    );
    expect(order.score).toBe(250);
    const refund = await ingestEvent(
      {
        artistId: artist.id,
        source: "shopify",
        type: EVENT_TYPES.shopifyOrderRefunded,
        sourceEventId: "refund:3001",
        email,
        metadata: { originalSourceEventId: "order:3001", refundedCents: 5000 },
      },
      db,
    );
    expect(refund.score).toBe(0);
    const [af] = await db
      .select()
      .from(artistFans)
      .where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, order.fanId!)));
    expect(af.lifetimeSpendCents).toBe(0);
  });

  it("caps Instagram comment score at 100 per week", async () => {
    const { artist } = await makeArtist();
    const identity = { provider: "instagram" as const, externalUserId: "spammer_1", username: "spammer" };
    let last = 0;
    for (let i = 0; i < 25; i++) {
      const res = await ingestEvent(
        {
          artistId: artist.id,
          source: "instagram",
          type: EVENT_TYPES.instagramComment,
          sourceEventId: `comment:${i}`,
          occurredAt: new Date(Date.now() - (25 - i) * 60_000),
          identity,
          metadata: { text: `comment number ${i}` },
        },
        db,
      );
      last = res.score;
    }
    // 20 (first comment) + 100 (weekly cap on regular comments) = 120
    expect(last).toBe(120);
  });

  it("awards Nth-concert score tiers", async () => {
    const { artist } = await makeArtist();
    const email = uniqueEmail();
    const scores: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await ingestEvent(
        {
          artistId: artist.id,
          source: "superfan",
          type: EVENT_TYPES.eventCheckedIn,
          sourceEventId: `checkin:${i}`,
          email,
          metadata: { eventName: `Show ${i}` },
        },
        db,
      );
      scores.push(res.score);
    }
    expect(scores).toEqual([750, 1650, 2650, 3650]);
    const [af] = await db.select().from(artistFans).where(eq(artistFans.artistId, artist.id));
    expect(af.eventsAttendedCount).toBe(4);
  });

  it("creates a shadow fan for an unclaimed Instagram identity and does not merge by username", async () => {
    const { artist } = await makeArtist();
    // A real fan with an email whose name happens to match the IG username.
    await ingestEvent(
      {
        artistId: artist.id,
        source: "superfan",
        type: EVENT_TYPES.fanJoined,
        email: uniqueEmail(),
        profile: { firstName: "jamesmusic" },
      },
      db,
    );
    const res = await ingestEvent(
      {
        artistId: artist.id,
        source: "instagram",
        type: EVENT_TYPES.instagramComment,
        sourceEventId: "c1",
        identity: { provider: "instagram", externalUserId: "ig_777", username: "jamesmusic" },
        metadata: { text: "love this" },
      },
      db,
    );
    expect(res.fanCreated).toBe(true);
    const [identity] = await db.select().from(fanIdentities).where(eq(fanIdentities.id, res.identityId!));
    expect(identity.claimed).toBe(false);
    expect(identity.fanId).toBe(res.fanId);
    const [fan] = await db.select().from(fans).where(eq(fans.id, res.fanId!));
    expect(fan.email).toBeNull();
  });

  it("stores unknown event types without scoring them", async () => {
    const { artist } = await makeArtist();
    const res = await ingestEvent(
      { artistId: artist.id, source: "manual", type: "custom.note_added", email: uniqueEmail(), metadata: {} },
      db,
    );
    expect(res.status).toBe("created");
    expect(res.ledger).toHaveLength(0);
    const rows = await db.select().from(scoreLedger).where(eq(scoreLedger.fanId, res.fanId!));
    expect(rows).toHaveLength(0);
  });
});
