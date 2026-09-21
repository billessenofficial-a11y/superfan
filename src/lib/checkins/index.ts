import { and, eq, sql } from "drizzle-orm";
import { db as defaultDb, type Database, type DbOrTx } from "@/db";
import { artistEvents, eventCheckins } from "@/db/schema";
import { audit, track } from "@/lib/audit";
import { randomToken, signToken, verifyToken } from "@/lib/crypto";
import { appUrl } from "@/lib/env";
import { ingestEvent } from "@/lib/events/ingest";
import { EVENT_TYPES } from "@/lib/events/types";
import { resolveActor } from "@/lib/identity/resolver";
import { awardPoints } from "@/lib/points/ledger";

export class CheckinError extends Error {
  constructor(
    public readonly code:
      | "invalid_token"
      | "expired_token"
      | "event_not_found"
      | "window_closed"
      | "already_checked_in"
      | "cancelled",
    message: string,
  ) {
    super(message);
    this.name = "CheckinError";
  }
}

export type ArtistEvent = typeof artistEvents.$inferSelect;

type CheckinTokenPayload = {
  v: 1;
  eventId: string;
  artistId: string;
  /** Rotating per-event secret. Rotating it invalidates every previously printed QR. */
  s: string;
  exp?: number;
};

/**
 * Signed, rotating check-in token embedded in the event QR code.
 * The token alone never grants a check-in: the event's activation window
 * and one-check-in-per-fan rule are enforced server-side.
 */
export function createCheckinToken(event: Pick<ArtistEvent, "id" | "artistId" | "checkinSecret">, ttlHours = 24 * 14): string {
  return signToken({
    v: 1,
    eventId: event.id,
    artistId: event.artistId,
    s: event.checkinSecret,
    exp: Math.floor(Date.now() / 1000) + ttlHours * 3600,
  } satisfies CheckinTokenPayload);
}

export function checkinUrl(token: string): string {
  return appUrl(`/checkin/${token}`);
}

export function newCheckinSecret(): string {
  return randomToken(16);
}

export type CheckinWindow = {
  open: boolean;
  reason?: "not_yet" | "closed" | "cancelled";
  opensAt: Date;
  closesAt: Date;
};

/** Default window: 3h before doors until 6h after start. */
export function checkinWindow(event: ArtistEvent, now = new Date()): CheckinWindow {
  const opensAt = event.checkinOpensAt ?? new Date(event.startsAt.getTime() - 3 * 3600_000);
  const closesAt = event.checkinClosesAt ?? new Date((event.endsAt ?? event.startsAt).getTime() + 6 * 3600_000);
  if (event.status === "cancelled") return { open: false, reason: "cancelled", opensAt, closesAt };
  if (now < opensAt) return { open: false, reason: "not_yet", opensAt, closesAt };
  if (now > closesAt) return { open: false, reason: "closed", opensAt, closesAt };
  return { open: true, opensAt, closesAt };
}

/** Resolve a token to its event, verifying signature and rotating secret. */
export async function resolveCheckinToken(tx: DbOrTx, token: string): Promise<ArtistEvent> {
  const verified = verifyToken<CheckinTokenPayload>(token);
  if (!verified.ok) {
    throw new CheckinError(verified.reason === "expired" ? "expired_token" : "invalid_token", "This QR code is not valid.");
  }
  const payload = verified.payload;
  const [event] = await tx.select().from(artistEvents).where(eq(artistEvents.id, payload.eventId)).limit(1);
  if (!event || event.artistId !== payload.artistId) throw new CheckinError("event_not_found", "Event not found.");
  if (event.checkinSecret !== payload.s) throw new CheckinError("expired_token", "This QR code has been replaced. Ask staff for the current one.");
  return event;
}

/**
 * Check a fan into an event. One check-in per fan per event, only inside
 * the activation window. Awards points and emits the attendance event.
 */
export async function checkInFan(
  input: { token?: string; eventId?: string; fanId: string; method?: "qr" | "staff" | "manual"; verifiedByUserId?: string | null; now?: Date },
  conn: Database = defaultDb,
) {
  return conn.transaction(async (tx) => {
    let event: ArtistEvent;
    if (input.token) {
      event = await resolveCheckinToken(tx, input.token);
    } else if (input.eventId) {
      const [row] = await tx.select().from(artistEvents).where(eq(artistEvents.id, input.eventId)).limit(1);
      if (!row) throw new CheckinError("event_not_found", "Event not found.");
      event = row;
    } else {
      throw new CheckinError("invalid_token", "Missing token.");
    }

    const isStaff = input.method === "staff" || input.method === "manual";
    if (!isStaff) {
      const window = checkinWindow(event, input.now);
      if (!window.open) {
        const message =
          window.reason === "cancelled"
            ? "This event was cancelled."
            : window.reason === "not_yet"
              ? "Check-in has not opened yet. Come back closer to showtime."
              : "Check-in for this event has closed.";
        throw new CheckinError(window.reason === "cancelled" ? "cancelled" : "window_closed", message);
      }
    }

    await resolveActor(tx, { artistId: event.artistId, fanId: input.fanId, source: "superfan" });

    const [checkin] = await tx
      .insert(eventCheckins)
      .values({
        artistId: event.artistId,
        eventId: event.id,
        fanId: input.fanId,
        verification: isStaff ? "artist_verified" : "verified",
        method: input.method ?? "qr",
        verifiedByUserId: input.verifiedByUserId ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (!checkin) throw new CheckinError("already_checked_in", "You are already checked in to this show.");

    await tx.update(artistEvents).set({ checkinsCount: sql`${artistEvents.checkinsCount} + 1` }).where(eq(artistEvents.id, event.id));

    if (event.checkinPoints > 0) {
      await awardPoints(tx, {
        artistId: event.artistId,
        fanId: input.fanId,
        amount: event.checkinPoints,
        type: "CHECKIN",
        sourceId: checkin.id,
        description: `Checked in at ${event.name}`,
      });
    }

    const ingest = await ingestEvent(
      {
        artistId: event.artistId,
        fanId: input.fanId,
        source: "superfan",
        type: isStaff ? EVENT_TYPES.manualAttendanceVerified : EVENT_TYPES.eventCheckedIn,
        sourceEventId: `checkin:${checkin.id}`,
        verification: isStaff ? "artist_verified" : "verified",
        metadata: { eventId: event.id, eventName: event.name, city: event.city, method: input.method ?? "qr" },
        summary: `Checked in at ${event.name}${event.city ? ` · ${event.city}` : ""}`,
      },
      tx,
    );

    if (isStaff && input.verifiedByUserId) {
      await audit(tx, {
        artistId: event.artistId,
        actorUserId: input.verifiedByUserId,
        action: "fan.attendance_verified",
        targetType: "fan",
        targetId: input.fanId,
        metadata: { eventId: event.id, method: input.method },
      });
    }
    await track(tx, "event_checked_in", { artistId: event.artistId, fanId: input.fanId }, { eventId: event.id, method: input.method ?? "qr" });

    return { checkin, event, ingest };
  });
}

export async function rotateCheckinSecret(tx: DbOrTx, artistId: string, eventId: string, actorUserId: string | null) {
  const [event] = await tx
    .update(artistEvents)
    .set({ checkinSecret: newCheckinSecret(), checkinSecretRotatedAt: new Date() })
    .where(and(eq(artistEvents.id, eventId), eq(artistEvents.artistId, artistId)))
    .returning();
  if (event) {
    await audit(tx, { artistId, actorUserId, action: "event.secret_rotated", targetType: "event", targetId: eventId });
  }
  return event ?? null;
}
