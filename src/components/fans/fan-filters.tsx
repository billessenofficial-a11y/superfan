"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { activeFilterCount, FAN_SOURCES, LAST_ACTIVE_OPTIONS, toSearchParams, type FanFilterState } from "./fan-filter-params";

const ANY = "__any";
const SOURCE_LABELS: Record<string, string> = { instagram: "Instagram", shopify: "Shopify", superfan: "Superfan", csv: "CSV import", spotify: "Spotify", tiktok: "TikTok", ticketmaster: "Ticketmaster", manual: "Manual" };

type Props = {
  state: FanFilterState;
  levels: { id: string; name: string; color: string }[];
  cities: { city: string | null; count: number }[];
  tags: { id: string; name: string; color: string }[];
  segment: { id: string; name: string } | null;
};

export function FanFilters({ state, levels, cities, tags, segment }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = React.useState(state.q);
  const [lastPushedQ, setLastPushedQ] = React.useState(state.q);
  const [open, setOpen] = React.useState(activeFilterCount(state) > (state.q ? 1 : 0));
  // Local mirrors for range inputs so typing is not throttled by navigation.
  const [draft, setDraft] = React.useState(state);

  // Re-sync local mirrors when the URL state changes from outside (Clear, back button).
  const [prevState, setPrevState] = React.useState(state);
  if (prevState !== state) {
    setPrevState(state);
    setDraft(state);
    if (state.q !== prevState.q && state.q !== lastPushedQ) setQ(state.q);
  }

  const push = React.useCallback(
    (patch: Partial<FanFilterState>) => {
      const next: FanFilterState = { ...state, ...patch, page: 1 };
      if (patch.q !== undefined) setLastPushedQ(patch.q);
      const qs = toSearchParams(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, state],
  );

  // Debounced search (≥300ms).
  React.useEffect(() => {
    if (q.trim() === state.q) return;
    const t = setTimeout(() => push({ q: q.trim() }), 320);
    return () => clearTimeout(t);
  }, [q, state.q, push]);

  const commitDraft = (key: keyof FanFilterState) => {
    const value = draft[key];
    if (value !== state[key]) push({ [key]: value } as Partial<FanFilterState>);
  };

  const count = activeFilterCount(state);
  const cityOptions = cities.filter((c): c is { city: string; count: number } => Boolean(c.city));
  const cityMissing = state.city && !cityOptions.some((c) => c.city.toLowerCase() === state.city.toLowerCase());

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, @instagram…" className="pl-9" aria-label="Search fans" />
          {q ? (
            <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-subtle hover:bg-muted hover:text-foreground" aria-label="Clear search">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <Select value={state.level || ANY} onValueChange={(v) => push({ level: v === ANY ? "" : v })}>
          <SelectTrigger className="w-[9.5rem]" aria-label="Level">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any level</SelectItem>
            {levels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={state.lastActive || ANY} onValueChange={(v) => push({ lastActive: v === ANY ? "" : v })}>
          <SelectTrigger className="w-[10rem]" aria-label="Last active">
            <SelectValue placeholder="Last active" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any time</SelectItem>
            {LAST_ACTIVE_OPTIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                Active in {d} days
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button type="button" variant={open ? "secondary" : "outline"} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <SlidersHorizontal />
          Filters
          {count > 0 ? <span className="tabular rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">{count}</span> : null}
        </Button>

        {count > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => router.replace(segment ? `${pathname}?segment=${segment.id}` : pathname, { scroll: false })}>
            Clear
          </Button>
        ) : null}
      </div>

      {segment ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="accent" className="gap-1.5 py-1 pl-2.5 pr-1.5 text-xs">
            Segment: {segment.name}
            <button type="button" onClick={() => push({ segment: "" })} className="rounded-full p-0.5 hover:bg-accent/20" aria-label="Remove segment filter">
              <X className="size-3" />
            </button>
          </Badge>
        </div>
      ) : null}

      <div className={cn("card-surface grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4", open ? "animate-rise" : "hidden")}>
        <RangeField label="Superfan score" minKey="minScore" maxKey="maxScore" draft={draft} setDraft={setDraft} commit={commitDraft} />
        <RangeField label="Reward points" minKey="minPoints" maxKey="maxPoints" draft={draft} setDraft={setDraft} commit={commitDraft} />

        <div className="flex flex-col gap-1.5">
          <Label>City</Label>
          <Select value={state.city || ANY} onValueChange={(v) => push({ city: v === ANY ? "" : v })}>
            <SelectTrigger aria-label="City">
              <SelectValue placeholder="Any city" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any city</SelectItem>
              {cityMissing ? <SelectItem value={state.city}>{state.city}</SelectItem> : null}
              {cityOptions.map((c) => (
                <SelectItem key={c.city} value={c.city}>
                  {c.city} <span className="tabular text-subtle">· {c.count}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-country">Country</Label>
          <Input id="f-country" value={draft.country} onChange={(e) => setDraft({ ...draft, country: e.target.value })} onBlur={() => commitDraft("country")} onKeyDown={(e) => e.key === "Enter" && commitDraft("country")} placeholder="e.g. US" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-spend">Lifetime spend ≥ ($)</Label>
          <Input id="f-spend" type="number" min={0} inputMode="decimal" value={draft.minSpend} onChange={(e) => setDraft({ ...draft, minSpend: e.target.value })} onBlur={() => commitDraft("minSpend")} onKeyDown={(e) => e.key === "Enter" && commitDraft("minSpend")} placeholder="0" className="tabular" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="f-events">Events attended ≥</Label>
          <Input id="f-events" type="number" min={0} inputMode="numeric" value={draft.minEvents} onChange={(e) => setDraft({ ...draft, minEvents: e.target.value })} onBlur={() => commitDraft("minEvents")} onKeyDown={(e) => e.key === "Enter" && commitDraft("minEvents")} placeholder="0" className="tabular" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>First source</Label>
          <Select value={state.source || ANY} onValueChange={(v) => push({ source: v === ANY ? "" : v })}>
            <SelectTrigger aria-label="Source">
              <SelectValue placeholder="Any source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any source</SelectItem>
              {FAN_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Tag</Label>
          <Select value={state.tag || ANY} onValueChange={(v) => push({ tag: v === ANY ? "" : v })}>
            <SelectTrigger aria-label="Tag">
              <SelectValue placeholder="Any tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any tag</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="inline-flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: t.color }} />
                    {t.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2 sm:col-span-2 lg:col-span-1">
          <span className="text-sm">Instagram engaged</span>
          <Switch checked={state.instagram} onCheckedChange={(v) => push({ instagram: v })} aria-label="Instagram engaged" />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3.5 py-2 sm:col-span-2 lg:col-span-1">
          <span className="text-sm">Shopify customer</span>
          <Switch checked={state.shopify} onCheckedChange={(v) => push({ shopify: v })} aria-label="Shopify customer" />
        </div>

        <div className="flex items-end justify-end sm:col-span-2 lg:col-span-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.replace(segment ? `${pathname}?segment=${segment.id}` : pathname, { scroll: false })} disabled={count === 0}>
            Reset to defaults
          </Button>
        </div>
      </div>
    </div>
  );
}

function RangeField({
  label,
  minKey,
  maxKey,
  draft,
  setDraft,
  commit,
}: {
  label: string;
  minKey: "minScore" | "minPoints";
  maxKey: "maxScore" | "maxPoints";
  draft: FanFilterState;
  setDraft: (s: FanFilterState) => void;
  commit: (k: keyof FanFilterState) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input type="number" inputMode="numeric" min={0} value={draft[minKey]} onChange={(e) => setDraft({ ...draft, [minKey]: e.target.value })} onBlur={() => commit(minKey)} onKeyDown={(e) => e.key === "Enter" && commit(minKey)} placeholder="Min" className="tabular" aria-label={`${label} minimum`} />
        <span className="text-subtle">–</span>
        <Input type="number" inputMode="numeric" min={0} value={draft[maxKey]} onChange={(e) => setDraft({ ...draft, [maxKey]: e.target.value })} onBlur={() => commit(maxKey)} onKeyDown={(e) => e.key === "Enter" && commit(maxKey)} placeholder="Max" className="tabular" aria-label={`${label} maximum`} />
      </div>
    </div>
  );
}
