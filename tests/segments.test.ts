import { afterAll, describe, expect, it } from "vitest";
import type { SegmentGroup } from "@/db/schema";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { listFans } from "@/lib/fans/queries";
import { countSegment, segmentGroupSchema } from "@/lib/segments/query";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

describe("segments", () => {
  it("counts fans matching AND / OR rule trees", async () => {
    const { artist } = await makeArtist();
    // LA big spender
    await ingestEvent({ artistId: artist.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "s1", email: uniqueEmail(), profile: { city: "Los Angeles" }, metadata: { amountCents: 20000 } }, db);
    // LA small spender
    await ingestEvent({ artistId: artist.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "s2", email: uniqueEmail(), profile: { city: "Los Angeles" }, metadata: { amountCents: 1000 } }, db);
    // NY big spender
    await ingestEvent({ artistId: artist.id, source: "shopify", type: EVENT_TYPES.shopifyOrderCreated, sourceEventId: "s3", email: uniqueEmail(), profile: { city: "New York" }, metadata: { amountCents: 30000 } }, db);
    // London, attended a show
    await ingestEvent({ artistId: artist.id, source: "superfan", type: EVENT_TYPES.eventCheckedIn, sourceEventId: "c1", email: uniqueEmail(), profile: { city: "London" }, metadata: { eventName: "Brixton" } }, db);

    const laBig: SegmentGroup = { kind: "group", match: "all", children: [
      { kind: "condition", field: "city", operator: "eq", value: "los angeles" },
      { kind: "condition", field: "lifetime_spend", operator: "gt", value: 100 },
    ] };
    expect(await countSegment(db, artist.id, laBig)).toBe(1);

    const laOrAttended: SegmentGroup = { kind: "group", match: "any", children: [
      { kind: "condition", field: "city", operator: "eq", value: "Los Angeles" },
      { kind: "condition", field: "events_attended", operator: "gte", value: 1 },
    ] };
    expect(await countSegment(db, artist.id, laOrAttended)).toBe(3);

    const nested: SegmentGroup = { kind: "group", match: "all", children: [
      { kind: "condition", field: "superfan_score", operator: "gt", value: 0 },
      { kind: "group", match: "any", children: [
        { kind: "condition", field: "city", operator: "contains", value: "york" },
        { kind: "condition", field: "city", operator: "eq", value: "London" },
      ] },
    ] };
    expect(await countSegment(db, artist.id, nested)).toBe(2);

    const unknownCity: SegmentGroup = { kind: "group", match: "all", children: [{ kind: "condition", field: "city", operator: "is_unknown" }] };
    expect(await countSegment(db, artist.id, unknownCity)).toBe(0);

    // The fans list applies the same rules.
    const list = await listFans(artist.id, { rules: laBig }, db);
    expect(list.total).toBe(1);
    expect(list.rows[0].city).toBe("Los Angeles");
  });

  it("validates rule trees and rejects unknown fields", () => {
    expect(segmentGroupSchema.safeParse({ kind: "group", match: "all", children: [{ kind: "condition", field: "city", operator: "eq", value: "LA" }] }).success).toBe(true);
    expect(segmentGroupSchema.safeParse({ kind: "group", match: "all", children: [{ kind: "condition", field: "drop_table", operator: "eq", value: "x" }] }).success).toBe(false);
  });
});
