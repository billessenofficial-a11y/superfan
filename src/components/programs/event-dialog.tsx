"use client";

import * as React from "react";
import { Loader2, Search, Ticket } from "lucide-react";
import { saveEventAction, searchTicketmasterAction } from "@/lib/actions/events";
import type { DiscoveredEvent } from "@/lib/integrations/ticketmaster";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { fromLocalInput, intOr, intOrNull, toLocalInput } from "./form-utils";
import { useRunAction } from "./use-run-action";
import type { EventRow } from "./events-view";

type Status = "draft" | "upcoming" | "live" | "completed" | "cancelled";

const STATUSES: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "upcoming", label: "Upcoming" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

type FormState = {
  name: string;
  description: string;
  venue: string;
  city: string;
  region: string;
  country: string;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  status: Status;
  checkinOpensAt: string;
  checkinClosesAt: string;
  checkinPoints: string;
  requiresStaffVerification: boolean;
  ticketmasterEventId: string;
  capacity: string;
};

function initialState(event: EventRow | null): FormState {
  return {
    name: event?.name ?? "",
    description: event?.description ?? "",
    venue: event?.venue ?? "",
    city: event?.city ?? "",
    region: event?.region ?? "",
    country: event?.country ?? "",
    imageUrl: event?.imageUrl ?? "",
    startsAt: toLocalInput(event?.startsAt),
    endsAt: toLocalInput(event?.endsAt),
    status: event?.status ?? "upcoming",
    checkinOpensAt: toLocalInput(event?.checkinOpensAt),
    checkinClosesAt: toLocalInput(event?.checkinClosesAt),
    checkinPoints: event ? String(event.checkinPoints) : "500",
    requiresStaffVerification: event?.requiresStaffVerification ?? false,
    ticketmasterEventId: event?.ticketmasterEventId ?? "",
    capacity: event?.capacity != null ? String(event.capacity) : "",
  };
}

export function EventDialog({ open, onOpenChange, event, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; event: EventRow | null; onSaved?: (id: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open ? (
          <EventForm
            key={event?.id ?? "new"}
            event={event}
            onDone={(id) => {
              onOpenChange(false);
              if (id) onSaved?.(id);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({ event, onDone }: { event: EventRow | null; onDone: (id?: string) => void }) {
  const [form, setForm] = React.useState<FormState>(() => initialState(event));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [importOpen, setImportOpen] = React.useState(!event);
  const { pending, run } = useRunAction();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const applyDiscovered = (d: DiscoveredEvent) => {
    setForm((f) => ({
      ...f,
      name: d.name || f.name,
      venue: d.venue ?? f.venue,
      city: d.city ?? f.city,
      region: d.region ?? f.region,
      country: d.country ?? f.country,
      imageUrl: d.imageUrl ?? f.imageUrl,
      startsAt: d.startsAt ? toLocalInput(d.startsAt) : f.startsAt,
      ticketmasterEventId: d.id,
    }));
    setImportOpen(false);
    toast.success("Event details filled in", { description: "Review and adjust before saving." });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const startsAt = fromLocalInput(form.startsAt);
    if (!startsAt) {
      setErrors({ startsAt: "Pick a start date and time." });
      return;
    }
    run(
      () =>
        saveEventAction({
          id: event?.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          venue: form.venue.trim() || undefined,
          city: form.city.trim() || undefined,
          region: form.region.trim() || undefined,
          country: form.country.trim() || undefined,
          imageUrl: form.imageUrl.trim(),
          startsAt,
          endsAt: fromLocalInput(form.endsAt),
          status: form.status,
          checkinOpensAt: fromLocalInput(form.checkinOpensAt),
          checkinClosesAt: fromLocalInput(form.checkinClosesAt),
          checkinPoints: intOr(form.checkinPoints, 500),
          requiresStaffVerification: form.requiresStaffVerification,
          ticketmasterEventId: form.ticketmasterEventId.trim() || undefined,
          capacity: intOrNull(form.capacity),
        }),
      { success: event ? "Event updated" : "Event created", onSuccess: (data) => onDone(data.id), onError: (_e, fieldErrors) => setErrors(fieldErrors ?? {}) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{event ? "Edit event" : "Create event"}</DialogTitle>
        <DialogDescription>Fans check in by scanning the event QR during the check-in window and earn points for showing up.</DialogDescription>
      </DialogHeader>

      <div className="rounded-2xl border border-border bg-muted/40">
        <button type="button" onClick={() => setImportOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Ticket className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Import from Ticketmaster</span>
            <span className="block text-xs text-muted-foreground">Search your tour dates and pre-fill this form.</span>
          </span>
          <span className="text-xs text-muted-foreground">{importOpen ? "Hide" : "Show"}</span>
        </button>
        {importOpen ? (
          <div className="border-t border-border px-4 py-3">
            <TicketmasterSearch onPick={applyDiscovered} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="ev-name" error={errors.name} className="sm:col-span-2">
          <Input id="ev-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Iceman Tour — Toronto" required maxLength={140} />
        </Field>
        <Field label="Description" htmlFor="ev-description" error={errors.description} className="sm:col-span-2">
          <Textarea id="ev-description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Doors, support acts, anything fans should know." maxLength={1000} className="min-h-20" />
        </Field>

        <Field label="Venue" htmlFor="ev-venue" error={errors.venue}>
          <Input id="ev-venue" value={form.venue} onChange={(e) => set("venue", e.target.value)} placeholder="The Wiltern" maxLength={140} />
        </Field>
        <Field label="City" htmlFor="ev-city" error={errors.city}>
          <Input id="ev-city" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="Los Angeles" maxLength={80} />
        </Field>
        <Field label="Region / State" htmlFor="ev-region" error={errors.region}>
          <Input id="ev-region" value={form.region} onChange={(e) => set("region", e.target.value)} placeholder="CA" maxLength={80} />
        </Field>
        <Field label="Country" htmlFor="ev-country" error={errors.country}>
          <Input id="ev-country" value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="US" maxLength={80} />
        </Field>

        <Field label="Starts" htmlFor="ev-starts" error={errors.startsAt}>
          <Input id="ev-starts" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} required />
        </Field>
        <Field label="Ends" htmlFor="ev-ends" error={errors.endsAt}>
          <Input id="ev-ends" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </Field>

        <Field label="Check-in opens" htmlFor="ev-ci-open" error={errors.checkinOpensAt} hint="Default: 3h before start.">
          <Input id="ev-ci-open" type="datetime-local" value={form.checkinOpensAt} onChange={(e) => set("checkinOpensAt", e.target.value)} />
        </Field>
        <Field label="Check-in closes" htmlFor="ev-ci-close" error={errors.checkinClosesAt} hint="Default: 6h after the end.">
          <Input id="ev-ci-close" type="datetime-local" value={form.checkinClosesAt} onChange={(e) => set("checkinClosesAt", e.target.value)} />
        </Field>

        <Field label="Check-in points" htmlFor="ev-points" error={errors.checkinPoints}>
          <Input id="ev-points" type="number" min={0} max={100000} inputMode="numeric" value={form.checkinPoints} onChange={(e) => set("checkinPoints", e.target.value)} className="tabular" required />
        </Field>
        <Field label="Capacity" htmlFor="ev-capacity" error={errors.capacity} hint="Leave blank for unlimited.">
          <Input id="ev-capacity" type="number" min={0} inputMode="numeric" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="Unlimited" className="tabular" />
        </Field>

        <Field label="Status" error={errors.status}>
          <Select value={form.status} onValueChange={(v) => set("status", v as Status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ticketmaster event ID" htmlFor="ev-tm" error={errors.ticketmasterEventId}>
          <Input id="ev-tm" value={form.ticketmasterEventId} onChange={(e) => set("ticketmasterEventId", e.target.value)} placeholder="Optional" maxLength={80} className="font-mono" />
        </Field>

        <Field label="Image URL" htmlFor="ev-image" error={errors.imageUrl}>
          <Input id="ev-image" type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
        </Field>
        <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
          <div>
            <p className="text-sm font-medium">Staff verification</p>
            <p className="text-xs text-muted-foreground">Only your team can check fans in.</p>
          </div>
          <Switch checked={form.requiresStaffVerification} onCheckedChange={(v) => set("requiresStaffVerification", v)} aria-label="Requires staff verification" />
        </div>
      </div>

      <DialogFooter className="mt-0">
        <Button type="button" variant="ghost" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {event ? "Save changes" : "Create event"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function TicketmasterSearch({ onPick }: { onPick: (d: DiscoveredEvent) => void }) {
  const [keyword, setKeyword] = React.useState("");
  const [results, setResults] = React.useState<{ events: DiscoveredEvent[]; live: boolean } | null>(null);
  const [pending, start] = React.useTransition();

  const search = () => {
    const q = keyword.trim();
    if (!q) return;
    start(async () => {
      const res = await searchTicketmasterAction({ keyword: q });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResults(res.data);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Artist or tour name"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search();
            }
          }}
        />
        <Button type="button" variant="secondary" onClick={search} loading={pending} disabled={!keyword.trim()}>
          <Search /> Search
        </Button>
      </div>
      {results ? (
        <>
          {!results.live ? (
            <p className="text-xs text-warning">
              <Badge variant="warning" className="mr-1.5">
                Sample results
              </Badge>
              Set TICKETMASTER_API_KEY to search live Discovery data.
            </p>
          ) : null}
          {results.events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events found for “{keyword}”.</p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {results.events.map((ev) => (
                <li key={ev.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ev.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[ev.venue, ev.city, ev.region].filter(Boolean).join(" · ")}
                      {ev.startsAt ? ` · ${formatDate(ev.startsAt, { month: "short", day: "numeric", year: "numeric" })}` : ""}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={() => onPick(ev)}>
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : pending ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Searching…
        </div>
      ) : null}
    </div>
  );
}
