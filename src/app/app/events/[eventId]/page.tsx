import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { db } from "@/db";
import { artistEvents, eventCheckins, fans } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { checkinUrl, checkinWindow, createCheckinToken } from "@/lib/checkins";
import { formatDate, formatNumber, isUuid } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/shared/stat";
import { Badge } from "@/components/ui/badge";
import { AttendeesList, EventDetailActions, QrPanel, StaffCheckin } from "@/components/programs/event-detail";
import { StatusBadge } from "@/components/programs/status-badge";

export const metadata = { title: "Event · Superfan" };

export default async function EventDetailPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!isUuid(eventId)) notFound();
  const ctx = await requireArtistContext();

  const [event] = await db
    .select()
    .from(artistEvents)
    .where(and(eq(artistEvents.id, eventId), eq(artistEvents.artistId, ctx.artist.id)))
    .limit(1);
  if (!event) notFound();

  const [attendees, qrDataUrl] = await Promise.all([
    db
      .select({
        id: eventCheckins.id,
        fanId: eventCheckins.fanId,
        firstName: fans.firstName,
        lastName: fans.lastName,
        email: fans.email,
        avatarUrl: fans.avatarUrl,
        city: fans.city,
        method: eventCheckins.method,
        verification: eventCheckins.verification,
        checkedInAt: eventCheckins.checkedInAt,
      })
      .from(eventCheckins)
      .innerJoin(fans, eq(fans.id, eventCheckins.fanId))
      .where(and(eq(eventCheckins.eventId, event.id), eq(eventCheckins.artistId, ctx.artist.id)))
      .orderBy(desc(eventCheckins.checkedInAt))
      .limit(500),
    (async () => {
      const url = checkinUrl(createCheckinToken(event));
      return { url, dataUrl: await QRCode.toDataURL(url, { width: 512, margin: 1 }) };
    })(),
  ]);

  const window = checkinWindow(event);
  const canManage = can(ctx.role, "manageEvents");
  const location = [event.venue, event.city, event.region].filter(Boolean).join(" · ");
  const windowLabel = window.open ? "Open now" : window.reason === "not_yet" ? `Opens ${formatDate(window.opensAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : window.reason === "cancelled" ? "Cancelled" : "Closed";

  return (
    <div>
      <Link href="/app/events" className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> All events
      </Link>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={event.status} />
            {event.ticketmasterEventId ? <Badge variant="outline">Ticketmaster</Badge> : null}
          </span>
        }
        title={event.name}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              {formatDate(event.startsAt, { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </span>
            {location ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" /> {location}
              </span>
            ) : null}
          </span>
        }
        actions={<EventDetailActions event={event} canManage={canManage} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Check-ins" value={formatNumber(event.checkinsCount)} hint={event.capacity ? `${Math.round((event.checkinsCount / Math.max(1, event.capacity)) * 100)}% of capacity` : "No capacity limit"} />
        <Stat label="Capacity" value={event.capacity != null ? formatNumber(event.capacity) : "—"} hint={event.capacity != null ? `${formatNumber(Math.max(0, event.capacity - event.checkinsCount))} spots left` : "Unlimited"} />
        <Stat label="Points per check-in" value={formatNumber(event.checkinPoints)} hint={event.requiresStaffVerification ? "Staff verification required" : "Self check-in via QR"} />
        <Stat
          label="Check-in window"
          value={<span className={window.open ? "text-success" : undefined}>{windowLabel}</span>}
          hint={`${formatDate(window.opensAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} → ${formatDate(window.closesAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="flex flex-col gap-6">
          <QrPanel eventId={event.id} eventName={event.name} url={qrDataUrl.url} dataUrl={qrDataUrl.dataUrl} rotatedAt={event.checkinSecretRotatedAt} windowOpen={window.open} canManage={canManage} />
          {canManage ? <StaffCheckin eventId={event.id} /> : null}
        </div>
        <AttendeesList attendees={attendees} total={event.checkinsCount} />
      </div>
    </div>
  );
}
