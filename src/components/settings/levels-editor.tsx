"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { updateLevels } from "@/lib/actions/artist";
import { formatNumber } from "@/lib/utils";
import { LevelBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { intOr, newId } from "@/components/programs/form-utils";
import { useRunAction } from "@/components/programs/use-run-action";

type LevelInput = { id: string; name: string; minScore: number; color: string };
type Draft = { key: string; id?: string; name: string; minScore: string; color: string };

const PALETTE = ["#9ca3af", "#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa", "#fb7185", "#22d3ee"];

export function LevelsEditor({ levels, canManage }: { levels: LevelInput[]; canManage: boolean }) {
  const [drafts, setDrafts] = React.useState<Draft[]>(() => levels.map((l) => ({ key: l.id, id: l.id, name: l.name, minScore: String(l.minScore), color: l.color })));
  const { pending, run } = useRunAction();
  const update = (key: string, patch: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const sorted = [...drafts].sort((a, b) => intOr(a.minScore, 0) - intOr(b.minScore, 0));
  const firstIsZero = sorted.length > 0 && intOr(sorted[0].minScore, -1) === 0;
  const hasNames = drafts.every((d) => d.name.trim().length > 0);
  const valid = drafts.length >= 2 && drafts.length <= 10 && firstIsZero && hasNames;

  const add = () => {
    const highest = Math.max(0, ...drafts.map((d) => intOr(d.minScore, 0)));
    setDrafts((d) => [...d, { key: newId(), name: "", minScore: String(highest + 1000), color: PALETTE[d.length % PALETTE.length] }]);
  };

  const save = () =>
    run(() => updateLevels({ levels: drafts.map((d) => ({ id: d.id, name: d.name.trim(), minScore: intOr(d.minScore, 0), color: d.color })) }), {
      success: "Levels saved — recomputing every fan's level",
    });

  return (
    <div className="flex flex-col gap-4">
      {!canManage ? <p className="rounded-xl bg-muted px-4 py-2.5 text-xs text-muted-foreground">Levels are read-only for your role.</p> : null}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Fan levels</CardTitle>
              <CardDescription>Tiers fans climb as their Superfan Score grows. The first level must start at 0. Removing a level moves its fans to the tier below.</CardDescription>
            </div>
            {canManage ? (
              <Button size="sm" disabled={!valid} loading={pending} onClick={save}>
                Save levels
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {sorted.map((d, i) => (
              <React.Fragment key={d.key}>
                {i > 0 ? <span className="text-subtle">→</span> : null}
                <LevelBadge name={d.name || "Untitled"} color={d.color} />
              </React.Fragment>
            ))}
          </div>

          <div className="divide-y divide-border rounded-xl border border-border">
            {drafts.map((d) => (
              <div key={d.key} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3.5 py-3 sm:grid-cols-[2.5rem_1fr_10rem_auto]">
                <label className="relative block size-10 cursor-pointer overflow-hidden rounded-xl border border-input" style={{ background: d.color }} title="Pick a color">
                  <input type="color" value={d.color} onChange={(e) => update(d.key, { color: e.target.value })} disabled={!canManage} className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed" aria-label={`${d.name || "Level"} color`} />
                </label>
                <Input value={d.name} onChange={(e) => update(d.key, { name: e.target.value })} placeholder="Level name" maxLength={40} disabled={!canManage} className="h-9" aria-label="Level name" />
                <div className="relative col-span-3 sm:col-span-1">
                  <Input type="number" min={0} inputMode="numeric" value={d.minScore} onChange={(e) => update(d.key, { minScore: e.target.value })} disabled={!canManage} className="tabular h-9 pl-14" aria-label="Minimum score" />
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] text-subtle">from</span>
                </div>
                {canManage ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove level" disabled={drafts.length <= 2} onClick={() => setDrafts((list) => list.filter((x) => x.key !== d.key))} className="col-start-3 row-start-1 sm:col-start-4">
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {canManage && drafts.length < 10 ? (
              <Button type="button" variant="secondary" size="sm" onClick={add}>
                <Plus className="size-3.5" /> Add level
              </Button>
            ) : (
              <span />
            )}
            <p className="text-xs text-subtle">
              {!firstIsZero ? "The lowest level must start at 0." : !hasNames ? "Every level needs a name." : `${formatNumber(drafts.length)} levels · 2–10 allowed.`}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
