"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge, LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ProviderIcon } from "@/components/shared/provider-icon";
import type { FanListRow, FanSort } from "@/lib/fans/queries";
import { fanDisplayName } from "@/lib/fans/display";
import { cn, formatMoney, formatNumber, formatRelative } from "@/lib/utils";
import { toSearchParams, type FanFilterState } from "./fan-filter-params";

type Column = { key: string; label: string; sort?: FanSort; align?: "right"; className?: string };

const COLUMNS: Column[] = [
  { key: "fan", label: "Fan", sort: "name" },
  { key: "level", label: "Level" },
  { key: "score", label: "Score", sort: "score", align: "right" },
  { key: "points", label: "Points", sort: "points", align: "right" },
  { key: "city", label: "City" },
  { key: "spend", label: "Lifetime spend", sort: "spend", align: "right" },
  { key: "events", label: "Events", sort: "events", align: "right" },
  { key: "instagram", label: "Instagram", sort: "instagram" },
  { key: "last_active", label: "Last active", sort: "last_active", align: "right" },
];

type Props = {
  rows: FanListRow[];
  state: FanFilterState;
  total: number;
  page: number;
  pages: number;
  pageSize: number;
};

export function FanTable({ rows, state, total, page, pages, pageSize }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const navigate = (patch: Partial<FanFilterState>) => {
    const qs = toSearchParams({ ...state, ...patch }).toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const toggleSort = (sort: FanSort) => {
    if (state.sort === sort) navigate({ dir: state.dir === "desc" ? "asc" : "desc", page: 1 });
    else navigate({ sort, dir: sort === "name" ? "asc" : "desc", page: 1 });
  };

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-col gap-3">
      {/* Desktop table */}
      <div className="card-surface hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((c) => {
                const active = c.sort && state.sort === c.sort;
                return (
                  <TableHead key={c.key} className={cn(c.align === "right" && "text-right", c.className)} aria-sort={c.sort ? (active ? (state.dir === "asc" ? "ascending" : "descending") : "none") : undefined}>
                    {c.sort ? (
                      <button type="button" onClick={() => toggleSort(c.sort!)} className={cn("inline-flex items-center gap-1 rounded-md transition-colors hover:text-foreground", active && "text-foreground", c.align === "right" && "flex-row-reverse")}>
                        {c.label}
                        {active ? state.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-40" />}
                      </button>
                    ) : (
                      c.label
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const name = fanDisplayName(r);
              const href = `/app/fans/${r.fanId}`;
              return (
                <TableRow
                  key={r.fanId}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) return;
                    router.push(href);
                  }}
                >
                  <TableCell>
                    <Link href={href} className="flex items-center gap-3">
                      <Avatar src={r.avatarUrl} name={name} size={32} />
                      <span className="min-w-0">
                        <span className="block max-w-[14rem] truncate text-sm font-medium">{name}</span>
                        <span className="block max-w-[14rem] truncate text-xs text-muted-foreground">{r.email ?? "—"}</span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <LevelBadge name={r.levelName} color={r.levelColor} />
                  </TableCell>
                  <TableCell className="tabular text-right font-semibold">{formatNumber(r.superfanScore)}</TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">{formatNumber(r.rewardPoints)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.city ?? "—"}
                    {r.country ? <span className="text-subtle"> · {r.country}</span> : null}
                  </TableCell>
                  <TableCell className="tabular text-right">{formatMoney(r.lifetimeSpendCents)}</TableCell>
                  <TableCell className="tabular text-right">{formatNumber(r.eventsAttendedCount)}</TableCell>
                  <TableCell>
                    <InstagramCell username={r.instagramUsername} claimed={r.instagramClaimed} />
                  </TableCell>
                  <TableCell className="tabular text-right text-muted-foreground">{formatRelative(r.lastActiveAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <ul className="grid gap-2 md:hidden">
        {rows.map((r) => {
          const name = fanDisplayName(r);
          return (
            <li key={r.fanId}>
              <Link href={`/app/fans/${r.fanId}`} className="card-surface flex items-center gap-3 p-3.5 transition-colors active:bg-muted">
                <Avatar src={r.avatarUrl} name={name} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <LevelBadge name={r.levelName} color={r.levelColor} />
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {r.city ?? r.email ?? "—"} · {formatMoney(r.lifetimeSpendCents)} · {formatNumber(r.eventsAttendedCount)} events
                  </span>
                  {r.instagramUsername ? (
                    <span className="mt-1 block text-xs">
                      <InstagramCell username={r.instagramUsername} claimed={r.instagramClaimed} />
                    </span>
                  ) : null}
                </span>
                <span className="text-right">
                  <span className="tabular block text-base font-semibold">{formatNumber(r.superfanScore)}</span>
                  <span className="tabular block text-[11px] text-subtle">{formatRelative(r.lastActiveAt)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
        <p className="tabular text-xs text-muted-foreground">
          Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)} fans
        </p>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => navigate({ page: page - 1 })}>
            <ChevronLeft /> Prev
          </Button>
          <span className="tabular px-2 text-xs text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={page >= pages} onClick={() => navigate({ page: page + 1 })}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

function InstagramCell({ username, claimed }: { username: string | null; claimed: boolean | null }) {
  if (!username) return <span className="text-subtle">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <ProviderIcon provider="instagram" size={13} className="text-muted-foreground" />
      <span className="text-sm">@{username}</span>
      {claimed === false ? (
        <Badge variant="outline" className="text-[10px] text-subtle">
          unclaimed
        </Badge>
      ) : null}
    </span>
  );
}
