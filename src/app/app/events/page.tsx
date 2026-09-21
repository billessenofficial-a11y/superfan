import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { artistEvents } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { checkinWindow } from "@/lib/checkins";
import { EventsView } from "@/components/programs/events-view";

export const metadata = { title: "Events · Superfan" };

export default async function EventsPage() {
  const ctx = await requireArtistContext();
  const rows = await db.select().from(artistEvents).where(eq(artistEvents.artistId, ctx.artist.id)).orderBy(desc(artistEvents.startsAt));

  const now = new Date();
  const isPast = (e: (typeof rows)[number]) => e.status === "completed" || e.status === "cancelled" || checkinWindow(e, now).closesAt < now;
  const upcoming = rows.filter((e) => !isPast(e)).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const past = rows.filter(isPast);

  return <EventsView upcoming={upcoming} past={past} canManage={can(ctx.role, "manageEvents")} />;
}
