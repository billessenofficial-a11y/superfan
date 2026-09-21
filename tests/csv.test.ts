import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { artistFans, fanIdentities, fans, importRows } from "@/db/schema";
import { runImport, stageImport, suggestMapping } from "@/lib/csv/import";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

describe("csv import", () => {
  it("suggests a mapping from common headers", () => {
    const mapping = suggestMapping(["Email", "First Name", "Last Name", "City", "Instagram", "Total Spent", "Orders", "Weird Column"]);
    expect(mapping).toMatchObject({
      Email: "email",
      "First Name": "first_name",
      "Last Name": "last_name",
      City: "city",
      Instagram: "instagram_username",
      "Total Spent": "order_total",
      Orders: "orders_count",
      "Weird Column": null,
    });
  });

  it("stages, maps and imports fans with merch and attendance history", async () => {
    const { artist, owner } = await makeArtist();
    const a = uniqueEmail("a");
    const b = uniqueEmail("b");
    const csv = [
      "email,first_name,last_name,city,instagram,order_total,orders_count,event_name,event_date,attended",
      `${a},Sarah,Nguyen,Los Angeles,@sarah.n,284.00,3,,,`,
      `${b},Alex,Park,Chicago,,,,"Afterlight Tour — Chicago",2026-08-02,yes`,
      `,NoEmail,Person,Nowhere,,10,1,,,`,
      `not-an-email,Bad,Row,,,,,,,`,
    ].join("\n");

    const staged = await stageImport({ artistId: artist.id, fileName: "fans.csv", csvText: csv, sourceLabel: "2025 store export", createdByUserId: owner.id }, db);
    expect(staged.import.rowCount).toBe(4);
    expect(staged.import.mapping.instagram).toBe("instagram_username");

    const done = await runImport({ artistId: artist.id, importId: staged.import.id, mapping: staged.import.mapping, actorUserId: owner.id }, db);
    expect(done.status).toBe("completed");
    expect(done.importedCount).toBe(2);
    expect(done.skippedCount).toBe(2);

    const [sarah] = await db.select().from(fans).where(eq(fans.email, a));
    expect(sarah.firstName).toBe("Sarah");
    expect(sarah.city).toBe("Los Angeles");
    const [sarahAf] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, sarah.id)));
    expect(sarahAf.lifetimeSpendCents).toBe(28400);
    expect(sarahAf.ordersCount).toBe(3);
    // first purchase 150 + repeat 75 + 284*2 = 793
    expect(sarahAf.superfanScore).toBe(793);
    const [ig] = await db.select().from(fanIdentities).where(and(eq(fanIdentities.fanId, sarah.id), eq(fanIdentities.provider, "instagram")));
    expect(ig.username).toBe("sarah.n");
    expect(ig.verified).toBe(false);

    const [alex] = await db.select().from(fans).where(eq(fans.email, b));
    const [alexAf] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, alex.id)));
    expect(alexAf.eventsAttendedCount).toBe(1);
    expect(alexAf.superfanScore).toBe(750);

    const rows = await db.select().from(importRows).where(eq(importRows.importId, staged.import.id));
    expect(rows.filter((r) => r.status === "skipped")).toHaveLength(2);
  });

  it("re-running an import does not double count", async () => {
    const { artist, owner } = await makeArtist();
    const email = uniqueEmail();
    const csv = `email,order_total\n${email},50`;
    const staged = await stageImport({ artistId: artist.id, fileName: "x.csv", csvText: csv, createdByUserId: owner.id }, db);
    await runImport({ artistId: artist.id, importId: staged.import.id, mapping: staged.import.mapping, actorUserId: owner.id }, db);
    // Reset row status to simulate a retry.
    await db.update(importRows).set({ status: "pending" }).where(eq(importRows.importId, staged.import.id));
    await runImport({ artistId: artist.id, importId: staged.import.id, mapping: staged.import.mapping, actorUserId: owner.id }, db);
    const [fan] = await db.select().from(fans).where(eq(fans.email, email));
    const [af] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, fan.id)));
    expect(af.lifetimeSpendCents).toBe(5000);
    expect(af.ordersCount).toBe(1);
  });
});
