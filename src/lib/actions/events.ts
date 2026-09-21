"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { artistEvents } from "@/db/schema";
import { audit, track } from "@/lib/audit";
import { requireArtistAccess } from "@/lib/auth/context";
import { newCheckinSecret, rotateCheckinSecret } from "@/lib/checkins";
import { searchTicketmasterEvents } from "@/lib/integrations/ticketmaster";
import { act } from "./result";

const optionalDate = z.union([z.coerce.date(), z.literal(""), z.null()]).optional().transform((v) => (v instanceof Date ? v : null));

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Name is required").max(140),
  description: z.string().max(1000).optional(),
  venue: z.string().max(140).optional(),
  city: z.string().max(80).optional(),
  region: z.string().max(80).optional(),
  country: z.string().max(80).optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  startsAt: z.coerce.date(),
  endsAt: optionalDate,
  status: z.enum(["draft", "upcoming", "live", "completed", "cancelled"]).default("upcoming"),
  checkinOpensAt: optionalDate,
  checkinClosesAt: optionalDate,
  checkinPoints: z.number().int().min(0).max(100000).default(500),
  requiresStaffVerification: z.boolean().default(false),
  ticketmasterEventId: z.string().max(80).optional(),
  capacity: z.number().int().min(0).nullable().optional(),
});

export async function saveEventAction(input: z.input<typeof eventSchema>) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageEvents");
    const data = eventSchema.parse(input);
    if (data.checkinOpensAt && data.checkinClosesAt && data.checkinClosesAt <= data.checkinOpensAt) {
      throw Object.assign(new Error("Check-in must close after it opens."), { code: "validation" });
    }
    const values = {
      name: data.name,
      description: data.description ?? null,
      venue: data.venue || null,
      city: data.city || null,
      region: data.region || null,
      country: data.country || null,
      imageUrl: data.imageUrl || null,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
      status: data.status,
      checkinOpensAt: data.checkinOpensAt,
      checkinClosesAt: data.checkinClosesAt,
      checkinPoints: data.checkinPoints,
      requiresStaffVerification: data.requiresStaffVerification,
      ticketmasterEventId: data.ticketmasterEventId || null,
      capacity: data.capacity ?? null,
    };
    let id = data.id;
    if (id) {
      const [updated] = await db.update(artistEvents).set(values).where(and(eq(artistEvents.id, id), eq(artistEvents.artistId, ctx.artist.id))).returning({ id: artistEvents.id });
      if (!updated) throw Object.assign(new Error("Event not found."), { code: "not_found" });
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "event.edited", targetType: "event", targetId: id, metadata: { name: data.name } });
    } else {
      const [created] = await db.insert(artistEvents).values({ ...values, artistId: ctx.artist.id, checkinSecret: newCheckinSecret(), createdByUserId: ctx.user.id }).returning({ id: artistEvents.id });
      id = created.id;
      await audit(db, { artistId: ctx.artist.id, actorUserId: ctx.user.id, action: "event.created", targetType: "event", targetId: id, metadata: { name: data.name } });
      await track(db, "event_created", { artistId: ctx.artist.id, userId: ctx.user.id }, { hasTicketmaster: Boolean(data.ticketmasterEventId) });
    }
    revalidatePath("/app/events");
    revalidatePath(`/app/events/${id}`);
    return { id };
  });
}

export async function rotateEventSecretAction(input: { id: string }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageEvents");
    const event = await db.transaction((tx) => rotateCheckinSecret(tx, ctx.artist.id, input.id, ctx.user.id));
    if (!event) throw Object.assign(new Error("Event not found."), { code: "not_found" });
    revalidatePath(`/app/events/${input.id}`);
  });
}

export async function setEventStatusAction(input: { id: string; status: "draft" | "upcoming" | "live" | "completed" | "cancelled" }) {
  return act(async () => {
    const ctx = await requireArtistAccess("manageEvents");
    await db.update(artistEvents).set({ status: input.status }).where(and(eq(artistEvents.id, input.id), eq(artistEvents.artistId, ctx.artist.id)));
    revalidatePath("/app/events");
    revalidatePath(`/app/events/${input.id}`);
  });
}

/** Search Ticketmaster Discovery for tour dates to pre-fill an event. */
export async function searchTicketmasterAction(input: { keyword: string }) {
  return act(async () => {
    await requireArtistAccess("manageEvents");
    const keyword = z.string().min(1).max(120).parse(input.keyword);
    return searchTicketmasterEvents(keyword);
  });
}
