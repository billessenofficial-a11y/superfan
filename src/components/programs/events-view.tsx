"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Plus, QrCode, Users } from "lucide-react";
import type { artistEvents } from "@/db/schema";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { PageHeader, SectionTitle } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { EventDialog } from "./event-dialog";
import { StatusBadge } from "./status-badge";

export type EventRow = typeof artistEvents.$inferSelect;

export function EventsView({ upcoming, past, canManage }: { upcoming: EventRow[]; past: EventRow[]; canManage: boolean }) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const total = upcoming.length + past.length;

  return (
    <div>
      <PageHeader
        title="Events"
        description={total ? `${formatNumber(upcoming.length)} upcoming · ${formatNumber(past.length)} past` : "Shows, meetups and listening parties with QR check-in."}
        actions={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus /> Create event
            </Button>
          ) : null
        }
      />

      {total === 0 ? (
        <EmptyState
          icon={<CalendarDays />}
          title="Reward fans for showing up."
          description="Add your tour dates, print the QR at the door and every check-in becomes verified attendance on the fan's passport."
          actions={
            canManage ? (
              <Button onClick={() => setDialogOpen(true)}>
                <Plus /> Create Event
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          <section>
            <SectionTitle>Upcoming</SectionTitle>
            {upcoming.length === 0 ? (
              <EmptyState compact title="Nothing scheduled" description="Create your next show to start collecting check-ins." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {upcoming.map((e) => (
                  <EventCard key={e.id} event={e} />
                ))}
              </div>
            )}
          </section>
          {past.length > 0 ? (
            <section>
              <SectionTitle>Past</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {past.map((e) => (
                  <EventCard key={e.id} event={e} muted />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <EventDialog open={dialogOpen} onOpenChange={setDialogOpen} event={null} onSaved={(id) => router.push(`/app/events/${id}`)} />
    </div>
  );
}

function EventCard({ event, muted = false }: { event: EventRow; muted?: boolean }) {
  const location = [event.venue, event.city].filter(Boolean).join(" · ");
  const capacityPct = event.capacity ? Math.min(100, Math.round((event.checkinsCount / event.capacity) * 100)) : null;
  return (
    <Link href={`/app/events/${event.id}`} className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-2xl">
      <Card className={cn("flex h-full flex-col overflow-hidden transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg animate-rise", muted && "opacity-80")}>
        <div className="relative h-24 w-full overflow-hidden">
          {event.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="artist-gradient size-full" />
          )}
          <div className="absolute left-4 top-4 flex flex-col items-center rounded-xl bg-background/85 px-2.5 py-1.5 text-center shadow-sm backdrop-blur">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{formatDate(event.startsAt, { month: "short" })}</span>
            <span className="tabular text-lg font-semibold leading-none">{formatDate(event.startsAt, { day: "numeric" })}</span>
          </div>
          <div className="absolute right-3 top-3">
            <StatusBadge status={event.status} />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">{event.name}</h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <MapPin className="size-3 shrink-0" />
              {location || "Location TBA"}
              <span className="text-subtle">·</span>
              {formatDate(event.startsAt, { hour: "numeric", minute: "2-digit" })}
            </p>
          </div>
          <div className="mt-auto flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-3.5" />
              <span className="tabular">
                {formatNumber(event.checkinsCount)}
                {event.capacity ? ` / ${formatNumber(event.capacity)}` : ""}
              </span>
              check-ins
            </span>
            <span className="inline-flex items-center gap-1 text-accent">
              <QrCode className="size-3.5" />
              <span className="tabular">+{formatNumber(event.checkinPoints)}</span>
            </span>
          </div>
          {capacityPct != null ? (
            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${capacityPct}%` }} />
            </div>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
