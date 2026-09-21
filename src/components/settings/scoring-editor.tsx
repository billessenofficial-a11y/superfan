"use client";

import * as React from "react";
import { updateScoreRules, updateScoreWeights } from "@/lib/actions/artist";
import { DIMENSIONS, type CapWindow, type ScoreDimension } from "@/lib/scoring/defaults";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { intOr, intOrNull } from "@/components/programs/form-utils";
import { useRunAction } from "@/components/programs/use-run-action";

type Weights = Record<ScoreDimension, number>;

export type RuleRow = {
  id: string;
  key: string;
  label: string;
  category: string;
  dimension: ScoreDimension | "recency";
  points: number;
  perUnit: boolean;
  capPoints: number | null;
  capWindow: string | null;
  enabled: boolean;
};

const DIMENSION_META: Record<ScoreDimension, { label: string; hint: string; color: string }> = {
  commerce: { label: "Commerce", hint: "Merch and ticket purchases", color: "#f59e0b" },
  attendance: { label: "Attendance", hint: "Verified show check-ins", color: "#34d399" },
  engagement: { label: "Engagement", hint: "Comments, DMs, mentions", color: "#f472b6" },
  advocacy: { label: "Advocacy", hint: "Referrals that convert", color: "#60a5fa" },
  community: { label: "Community", hint: "Challenges and membership", color: "#a78bfa" },
};

const CAP_WINDOWS: { value: CapWindow; label: string }[] = [
  { value: "day", label: "per day" },
  { value: "week", label: "per week" },
  { value: "month", label: "per month" },
  { value: "lifetime", label: "lifetime" },
];

export function ScoringEditor({ weights, rules, canManage }: { weights: Weights; rules: RuleRow[]; canManage: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {!canManage ? <p className="rounded-xl bg-muted px-4 py-2.5 text-xs text-muted-foreground">Scoring is read-only for your role. Ask an admin to change weights or rules.</p> : null}
      <WeightsCard initial={weights} canManage={canManage} />
      <RulesCard initial={rules} canManage={canManage} />
    </div>
  );
}

function WeightsCard({ initial, canManage }: { initial: Weights; canManage: boolean }) {
  const [weights, setWeights] = React.useState<Record<ScoreDimension, string>>(() => Object.fromEntries(DIMENSIONS.map((d) => [d, String(initial[d])])) as Record<ScoreDimension, string>);
  const { pending, run } = useRunAction();
  const total = DIMENSIONS.reduce((s, d) => s + (Number(weights[d]) || 0), 0);
  const valid = Math.round(total) === 100;
  const dirty = DIMENSIONS.some((d) => Number(weights[d]) !== initial[d]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Dimension weights</CardTitle>
            <CardDescription>How much each dimension contributes to the 0–100 Superfan Score. Must add up to 100%.</CardDescription>
          </div>
          <span className={cn("tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", valid ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>{total}%</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {DIMENSIONS.map((d) => (
            <div key={d} className="h-full transition-[width] duration-300" style={{ width: `${Math.max(0, Math.min(100, Number(weights[d]) || 0))}%`, background: DIMENSION_META[d].color }} title={DIMENSION_META[d].label} />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-5">
          {DIMENSIONS.map((d) => (
            <div key={d} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: DIMENSION_META[d].color }} />
                <span className="text-xs font-medium">{DIMENSION_META[d].label}</span>
              </div>
              <div className="relative">
                <Input type="number" min={0} max={100} inputMode="numeric" value={weights[d]} onChange={(e) => setWeights((w) => ({ ...w, [d]: e.target.value }))} disabled={!canManage} className="tabular pr-7" aria-label={`${DIMENSION_META[d].label} weight`} />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-subtle">%</span>
              </div>
              <p className="mt-1.5 text-[11px] text-subtle">{DIMENSION_META[d].hint}</p>
            </div>
          ))}
        </div>
        {canManage ? (
          <div className="flex items-center justify-end gap-3">
            {!valid ? <span className="text-xs text-danger">Adjust by {100 - total > 0 ? "+" : ""}{100 - total} to reach 100%.</span> : null}
            <Button
              size="sm"
              disabled={!valid || !dirty}
              loading={pending}
              onClick={() =>
                run(() => updateScoreWeights(Object.fromEntries(DIMENSIONS.map((d) => [d, Number(weights[d]) || 0])) as Weights), {
                  success: "Weights saved — recomputing every fan's score",
                })
              }
            >
              Save weights
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type RuleDraft = { id: string; points: string; enabled: boolean; capPoints: string; capWindow: CapWindow };

function toDraft(r: RuleRow): RuleDraft {
  return { id: r.id, points: String(r.points), enabled: r.enabled, capPoints: r.capPoints != null ? String(r.capPoints) : "", capWindow: (CAP_WINDOWS.some((w) => w.value === r.capWindow) ? r.capWindow : "week") as CapWindow };
}

function RulesCard({ initial, canManage }: { initial: RuleRow[]; canManage: boolean }) {
  const [drafts, setDrafts] = React.useState<Record<string, RuleDraft>>(() => Object.fromEntries(initial.map((r) => [r.id, toDraft(r)])));
  const { pending, run } = useRunAction();
  const update = (id: string, patch: Partial<RuleDraft>) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const categories = Array.from(new Set(initial.map((r) => r.category)));
  const dirty = initial.some((r) => {
    const d = drafts[r.id];
    const original = toDraft(r);
    return d.points !== original.points || d.enabled !== original.enabled || d.capPoints !== original.capPoints || (d.capPoints !== "" && d.capWindow !== original.capWindow);
  });

  const save = () =>
    run(
      () =>
        updateScoreRules({
          rules: initial.map((r) => {
            const d = drafts[r.id];
            const capPoints = intOrNull(d.capPoints);
            return { id: r.id, points: intOr(d.points, r.points), enabled: d.enabled, capPoints, capWindow: capPoints == null ? null : d.capWindow };
          }),
        }),
      { success: "Scoring rules saved" },
    );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Scoring rules</CardTitle>
            <CardDescription>Raw points each action adds to a dimension. Caps stop passive activity from minting superfans.</CardDescription>
          </div>
          {canManage ? (
            <Button size="sm" disabled={!dirty} loading={pending} onClick={save}>
              Save rules
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 pt-0">
        {categories.map((category) => (
          <div key={category}>
            <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-subtle">{category}</h4>
            <div className="divide-y divide-border rounded-xl border border-border">
              <div className="hidden grid-cols-[1fr_7rem_6rem_7rem_9rem_3rem] items-center gap-3 px-3.5 py-2 text-[11px] font-medium uppercase tracking-wide text-subtle md:grid">
                <span>Rule</span>
                <span>Dimension</span>
                <span>Points</span>
                <span>Cap</span>
                <span>Window</span>
                <span className="text-right">On</span>
              </div>
              {initial
                .filter((r) => r.category === category)
                .map((r) => {
                  const d = drafts[r.id];
                  const dim = r.dimension === "recency" ? null : DIMENSION_META[r.dimension];
                  return (
                    <div key={r.id} className={cn("grid grid-cols-2 items-center gap-3 px-3.5 py-3 md:grid-cols-[1fr_7rem_6rem_7rem_9rem_3rem]", !d.enabled && "opacity-60")}>
                      <div className="col-span-2 min-w-0 md:col-span-1">
                        <p className="truncate text-sm font-medium">{r.label}</p>
                        <p className="truncate font-mono text-[11px] text-subtle">
                          {r.key}
                          {r.perUnit ? " · per unit" : ""}
                        </p>
                      </div>
                      <div>
                        <Badge variant="outline" className="gap-1.5">
                          {dim ? <span className="size-1.5 rounded-full" style={{ background: dim.color }} /> : null}
                          {dim?.label ?? r.dimension}
                        </Badge>
                      </div>
                      <Input type="number" min={-10000} max={10000} inputMode="numeric" value={d.points} onChange={(e) => update(r.id, { points: e.target.value })} disabled={!canManage} className="tabular h-9" aria-label={`${r.label} points`} />
                      <Input type="number" min={0} max={100000} inputMode="numeric" value={d.capPoints} onChange={(e) => update(r.id, { capPoints: e.target.value })} disabled={!canManage} placeholder="No cap" className="tabular h-9" aria-label={`${r.label} cap`} />
                      <Select value={d.capWindow} onValueChange={(v) => update(r.id, { capWindow: v as CapWindow })} disabled={!canManage || d.capPoints === ""}>
                        <SelectTrigger size="sm" className="h-9" aria-label={`${r.label} cap window`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CAP_WINDOWS.map((w) => (
                            <SelectItem key={w.value} value={w.value}>
                              {w.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex justify-end">
                        <Switch checked={d.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} disabled={!canManage} aria-label={`${r.label} enabled`} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
