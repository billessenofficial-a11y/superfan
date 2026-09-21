import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { artistEvents, artistFans, eventCheckins } from "@/db/schema";
import { checkInFan, CheckinError, createCheckinToken, newCheckinSecret, rotateCheckinSecret } from "@/lib/checkins";
import { resolveActor } from "@/lib/identity/resolver";
import { closeTestDb, db, makeArtist, uniqueEmail } from "./helpers";

afterAll(closeTestDb);

async function makeEvent(artistId: string, startsInMs = 30 * 60_000) {
  const [event] = await db
    .insert(artistEvents)
    .values({ artistId, name: "LA Show", city: "Los Angeles", startsAt: new Date(Date.now() + startsInMs), checkinSecret: newCheckinSecret(), checkinPoints: 500 })
    .returning();
  return event;
}

describe("check-ins", () => {
  it("one fan cannot check into the same event twice", async () => {
    const { artist } = await makeArtist();
    const event = await makeEvent(artist.id);
    const fan = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    const token = createCheckinToken(event);

    const first = await checkInFan({ token, fanId: fan.fanId }, db);
    expect(first.ingest.scoreDelta).toBe(750);
    await expect(checkInFan({ token, fanId: fan.fanId }, db)).rejects.toMatchObject({ code: "already_checked_in" });

    const rows = await db.select().from(eventCheckins).where(and(eq(eventCheckins.eventId, event.id), eq(eventCheckins.fanId, fan.fanId)));
    expect(rows).toHaveLength(1);
    const [af] = await db.select().from(artistFans).where(and(eq(artistFans.artistId, artist.id), eq(artistFans.fanId, fan.fanId)));
    expect(af.rewardPointsCached).toBe(500);
    expect(af.eventsAttendedCount).toBe(1);
    const [ev] = await db.select().from(artistEvents).where(eq(artistEvents.id, event.id));
    expect(ev.checkinsCount).toBe(1);
  });

  it("rejects check-ins outside the activation window", async () => {
    const { artist } = await makeArtist();
    const event = await makeEvent(artist.id, 5 * 86_400_000); // in 5 days
    const fan = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    await expect(checkInFan({ token: createCheckinToken(event), fanId: fan.fanId }, db)).rejects.toMatchObject({ code: "window_closed" });
  });

  it("rotating the event secret invalidates previously issued QR tokens", async () => {
    const { artist, owner } = await makeArtist();
    const event = await makeEvent(artist.id);
    const oldToken = createCheckinToken(event);
    const rotated = await rotateCheckinSecret(db, artist.id, event.id, owner.id);
    const fan = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    await expect(checkInFan({ token: oldToken, fanId: fan.fanId }, db)).rejects.toMatchObject({ code: "expired_token" });
    const res = await checkInFan({ token: createCheckinToken(rotated!), fanId: fan.fanId }, db);
    expect(res.checkin.eventId).toBe(event.id);
  });

  it("rejects tampered tokens", async () => {
    const { artist } = await makeArtist();
    const event = await makeEvent(artist.id);
    const fan = await resolveActor(db, { artistId: artist.id, email: uniqueEmail(), source: "superfan" });
    const token = createCheckinToken(event);
    const tampered = token.slice(0, -4) + "AAAA";
    await expect(checkInFan({ token: tampered, fanId: fan.fanId }, db)).rejects.toBeInstanceOf(CheckinError);
  });
});
