import type { FanListFilters, FanSort } from "@/lib/fans/queries";

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

export const FAN_SORTS: FanSort[] = ["score", "points", "spend", "events", "last_active", "name", "first_seen", "instagram"];
export const LAST_ACTIVE_OPTIONS = [7, 30, 90] as const;
export const FAN_SOURCES = ["instagram", "shopify", "superfan", "csv", "spotify", "tiktok", "ticketmaster", "manual"] as const;

/** URL-facing filter state (strings only; what the filter bar edits). */
export type FanFilterState = {
  q: string;
  level: string;
  minScore: string;
  maxScore: string;
  minPoints: string;
  maxPoints: string;
  city: string;
  country: string;
  minSpend: string;
  minEvents: string;
  instagram: boolean;
  shopify: boolean;
  lastActive: string;
  source: string;
  tag: string;
  segment: string;
  sort: FanSort;
  dir: "asc" | "desc";
  page: number;
};

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function num(v: string): number | undefined {
  if (!v.trim()) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function parseFanParams(sp: SearchParamsRecord): FanFilterState {
  const sort = one(sp.sort) as FanSort;
  const dir = one(sp.dir);
  const page = Number(one(sp.page));
  return {
    q: one(sp.q),
    level: one(sp.level),
    minScore: one(sp.minScore),
    maxScore: one(sp.maxScore),
    minPoints: one(sp.minPoints),
    maxPoints: one(sp.maxPoints),
    city: one(sp.city),
    country: one(sp.country),
    minSpend: one(sp.minSpend),
    minEvents: one(sp.minEvents),
    instagram: one(sp.instagram) === "1",
    shopify: one(sp.shopify) === "1",
    lastActive: one(sp.lastActive),
    source: one(sp.source),
    tag: one(sp.tag),
    segment: one(sp.segment),
    sort: FAN_SORTS.includes(sort) ? sort : "score",
    dir: dir === "asc" ? "asc" : "desc",
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/** Convert URL state into the query-module filter object (segment rules are attached by the page). */
export function toListFilters(s: FanFilterState): FanListFilters {
  return {
    search: s.q || undefined,
    levelId: s.level || undefined,
    minScore: num(s.minScore),
    maxScore: num(s.maxScore),
    minPoints: num(s.minPoints),
    maxPoints: num(s.maxPoints),
    city: s.city || undefined,
    country: s.country || undefined,
    minSpend: num(s.minSpend),
    minEvents: num(s.minEvents),
    instagram: s.instagram || undefined,
    shopify: s.shopify || undefined,
    lastActiveDays: num(s.lastActive),
    source: s.source || undefined,
    tagId: s.tag || undefined,
    sort: s.sort,
    dir: s.dir,
    page: s.page,
    pageSize: 25,
  };
}

/** Serialize state back to a query string, dropping defaults so URLs stay clean. */
export function toSearchParams(s: FanFilterState): URLSearchParams {
  const p = new URLSearchParams();
  const set = (k: string, v: string) => {
    if (v) p.set(k, v);
  };
  set("q", s.q);
  set("level", s.level);
  set("minScore", s.minScore);
  set("maxScore", s.maxScore);
  set("minPoints", s.minPoints);
  set("maxPoints", s.maxPoints);
  set("city", s.city);
  set("country", s.country);
  set("minSpend", s.minSpend);
  set("minEvents", s.minEvents);
  if (s.instagram) p.set("instagram", "1");
  if (s.shopify) p.set("shopify", "1");
  set("lastActive", s.lastActive);
  set("source", s.source);
  set("tag", s.tag);
  set("segment", s.segment);
  if (s.sort !== "score") p.set("sort", s.sort);
  if (s.dir !== "desc") p.set("dir", s.dir);
  if (s.page > 1) p.set("page", String(s.page));
  return p;
}

/** Number of non-default filters (for the "Clear filters" affordance). */
export function activeFilterCount(s: FanFilterState): number {
  let n = 0;
  if (s.q) n++;
  if (s.level) n++;
  if (s.minScore || s.maxScore) n++;
  if (s.minPoints || s.maxPoints) n++;
  if (s.city) n++;
  if (s.country) n++;
  if (s.minSpend) n++;
  if (s.minEvents) n++;
  if (s.instagram) n++;
  if (s.shopify) n++;
  if (s.lastActive) n++;
  if (s.source) n++;
  if (s.tag) n++;
  return n;
}

export const EMPTY_FAN_FILTERS: FanFilterState = parseFanParams({});
