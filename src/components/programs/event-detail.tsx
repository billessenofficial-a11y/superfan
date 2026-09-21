"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, Pencil, Printer, RefreshCw, Search, ShieldCheck, UserCheck, Users } from "lucide-react";
import { setEventStatusAction, rotateEventSecretAction } from "@/lib/actions/events";
import { findFanByEmailAction } from "@/lib/actions/events-extra";
import { verifyAttendanceAction } from "@/lib/actions/fans";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/utils";
import { SectionTitle } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/shared/action-button";
import { CopyButton } from "@/components/shared/copy-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { EventDialog } from "./event-dialog";
import type { EventRow } from "./events-view";
import { fanName } from "./form-utils";
import { useRunAction } from "./use-run-action";

type EventStatus = EventRow["status"];
const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export function EventDetailActions({ event, canManage }: { event: EventRow; canManage: boolean }) {
  const [editOpen, setEditOpen] = React.useState(false);
  const { pending, run } = useRunAction();
  if (!canManage) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" loading={pending}>
            {STATUS_OPTIONS.find((s) => s.value === event.status)?.label ?? event.status} <ChevronDown className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Set status</DropdownMenuLabel>
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s.value} disabled={s.value === event.status} destructive={s.value === "cancelled"} onSelect={() => run(() => setEventStatusAction({ id: event.id, status: s.value }), { success: `Event marked ${s.label.toLowerCase()}` })}>
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <EventDialog open={editOpen} onOpenChange={setEditOpen} event={event} />
    </>
  );
}

export function QrPanel({ eventId, eventName, url, dataUrl, rotatedAt, windowOpen, canManage }: { eventId: string; eventName: string; url: string; dataUrl: string; rotatedAt: Date; windowOpen: boolean; canManage: boolean }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Check-in QR</CardTitle>
          <Badge variant={windowOpen ? "success" : "outline"}>{windowOpen ? "Accepting check-ins" : "Window closed"}</Badge>
        </div>
        <CardDescription>Print this at the door. Fans scan it to check in and earn points.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="rounded-2xl bg-white p-3 shadow-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt={`Check-in QR code for ${eventName}`} width={256} height={256} className="size-56 sm:size-64" />
        </div>
        <p className="w-full truncate text-center font-mono text-[11px] text-subtle" title={url}>
          {url}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            <Printer className="size-3.5" /> Print
          </Button>
          <CopyButton value={url} label="Copy link" />
          {canManage ? (
            <ActionButton
              size="sm"
              variant="outline"
              action={() => rotateEventSecretAction({ id: eventId })}
              confirm="Rotate the check-in code? Every printed or shared QR for this event stops working immediately."
              successMessage="Check-in code rotated. Reprint the QR."
            >
              <RefreshCw className="size-3.5" /> Rotate code
            </ActionButton>
          ) : null}
        </div>
        <p className="text-center text-[11px] text-subtle">Code last rotated {formatRelative(rotatedAt)}. Rotating invalidates old prints.</p>
      </CardContent>

      {/* Print-only sheet: hides the dashboard and shows a clean poster. */}
      <style>{`@media print { body * { visibility: hidden !important; } #event-qr-print, #event-qr-print * { visibility: visible !important; } #event-qr-print { position: fixed; inset: 0; display: flex !important; } }`}</style>
      <div id="event-qr-print" className="hidden flex-col items-center justify-center gap-6 bg-white p-12 text-center text-black">
        <p className="text-sm font-medium uppercase tracking-[0.3em] text-neutral-500">Scan to check in</p>
        <h1 className="text-4xl font-semibold tracking-tight">{eventName}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="" width={512} height={512} className="size-[min(70vw,70vh)]" />
        <p className="max-w-xl break-all font-mono text-xs text-neutral-500">{url}</p>
      </div>
    </Card>
  );
}

type Attendee = { id: string; fanId: string; firstName: string | null; lastName: string | null; email: string | null; avatarUrl: string | null; city: string | null; method: string; verification: string; checkedInAt: Date };

export function AttendeesList({ attendees, total }: { attendees: Attendee[]; total: number }) {
  return (
    <section>
      <SectionTitle action={<span className="tabular text-xs text-muted-foreground">{formatNumber(total)} checked in</span>}>Attendees</SectionTitle>
      {attendees.length === 0 ? (
        <EmptyState compact icon={<Users />} title="No check-ins yet" description="Once fans scan the QR, they show up here in real time." />
      ) : (
        <Card className="divide-y divide-border">
          {attendees.map((a) => {
            const name = fanName(a);
            return (
              <Link key={a.id} href={`/app/fans/${a.fanId}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                <Avatar src={a.avatarUrl} name={name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-xs text-muted-foreground">{[a.email, a.city].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">{formatDateTime(a.checkedInAt)}</span>
                  {a.method !== "qr" ? (
                    <Badge variant="info">
                      <ShieldCheck /> Staff
                    </Badge>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </Card>
      )}
    </section>
  );
}

type FoundFan = NonNullable<Extract<Awaited<ReturnType<typeof findFanByEmailAction>>, { ok: true }>["data"]>;

export function StaffCheckin({ eventId }: { eventId: string }) {
  const [email, setEmail] = React.useState("");
  const [fan, setFan] = React.useState<FoundFan | null | undefined>(undefined);
  const [searching, startSearch] = React.useTransition();
  const { pending, run } = useRunAction();

  const search = () => {
    if (!email.trim()) return;
    startSearch(async () => {
      const res = await findFanByEmailAction({ email });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setFan(res.data);
    });
  };

  const checkIn = (fanId: string) =>
    run(() => verifyAttendanceAction({ fanId, eventId }), {
      success: (d) => `Checked in to ${d.eventName}`,
      onSuccess: () => {
        setFan(undefined);
        setEmail("");
      },
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Staff check-in</CardTitle>
        <CardDescription>Look a fan up by email and verify their attendance by hand.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            search();
          }}
        >
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fan@example.com" required />
          <Button type="submit" variant="secondary" loading={searching} aria-label="Find fan">
            <Search />
          </Button>
        </form>
        {fan === null ? <p className="text-xs text-muted-foreground">No fan with that email in your fanbase yet.</p> : null}
        {fan ? (
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Avatar src={fan.avatarUrl} name={fanName(fan)} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fanName(fan)}</p>
              <p className="truncate text-xs text-muted-foreground">
                Score {formatNumber(fan.superfanScore)} · {formatNumber(fan.eventsAttendedCount)} shows
                {fan.city ? ` · ${fan.city}` : ""}
              </p>
            </div>
            <Button size="sm" onClick={() => checkIn(fan.id)} loading={pending}>
              <UserCheck className="size-3.5" /> Check in
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
