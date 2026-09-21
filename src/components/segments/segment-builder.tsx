"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CornerDownRight, Loader2, Plus, Trash2, X } from "lucide-react";
import type { SegmentCondition, SegmentGroup, SegmentNode, SegmentOperator } from "@/db/schema";
import { previewSegmentCount, saveSegmentAction } from "@/lib/actions/segments";
import { EMPTY_SEGMENT, SEGMENT_FIELDS, type SegmentField } from "@/lib/segments/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { cn, formatNumber } from "@/lib/utils";

/* ───────────────────────── Options / labels ───────────────────────── */

export type BuilderOptions = {
  levels: { id: string; name: string; color: string }[];
  tags: { id: string; name: string; color: string }[];
  events: { id: string; name: string; startsAt: Date | string }[];
};

const SOURCES = ["instagram", "shopify", "superfan", "csv", "spotify", "tiktok", "ticketmaster", "manual"] as const;
const SOURCE_LABELS: Record<string, string> = { instagram: "Instagram", shopify: "Shopify", superfan: "Superfan", csv: "CSV import", spotify: "Spotify", tiktok: "TikTok", ticketmaster: "Ticketmaster", manual: "Manual" };

const fieldByKey = new Map(SEGMENT_FIELDS.map((f) => [f.key, f]));
const GROUPS = [...new Set(SEGMENT_FIELDS.map((f) => f.group))];

function operatorLabel(field: SegmentField, op: SegmentOperator): string {
  const numeric = field.type === "number" || field.type === "money" || field.type === "days" || field.type === "level";
  switch (op) {
    case "eq":
      return numeric && field.type !== "level" ? "equals" : "is";
    case "neq":
      return numeric && field.type !== "level" ? "does not equal" : "is not";
    case "gt":
      return "greater than";
    case "lt":
      return "less than";
    case "gte":
      return field.type === "level" ? "is at least" : "at least";
    case "lte":
      return field.type === "level" ? "is at most" : "at most";
    case "contains":
      return "contains";
    case "not_contains":
      return "does not contain";
    case "is_known":
      return field.type === "boolean" ? "is true" : "is set";
    case "is_unknown":
      return field.type === "boolean" ? "is false" : "is not set";
  }
}

function needsValue(op: SegmentOperator) {
  return op !== "is_known" && op !== "is_unknown";
}

function conditionComplete(c: SegmentCondition): boolean {
  const field = fieldByKey.get(c.field);
  if (!field) return false;
  if (!needsValue(c.operator)) return true;
  if (c.value == null || c.value === "") return false;
  if (field.type === "number" || field.type === "money" || field.type === "days") return Number.isFinite(Number(c.value));
  return true;
}

function treeComplete(node: SegmentNode): boolean {
  if (node.kind === "condition") return conditionComplete(node);
  return node.children.every(treeComplete);
}

function countConditions(node: SegmentNode): number {
  return node.kind === "condition" ? 1 : node.children.reduce((s, c) => s + countConditions(c), 0);
}

/* ───────────────────────── Immutable tree ops ───────────────────────── */

type Path = number[];

function updateAt(root: SegmentGroup, path: Path, next: SegmentNode): SegmentGroup {
  if (path.length === 0) return next.kind === "group" ? next : root;
  const [i, ...rest] = path;
  const child = root.children[i];
  const updated = rest.length === 0 ? next : child.kind === "group" ? updateAt(child, rest, next) : child;
  return { ...root, children: root.children.map((c, idx) => (idx === i ? updated : c)) };
}

function removeAt(root: SegmentGroup, path: Path): SegmentGroup {
  if (path.length === 0) return root;
  const [i, ...rest] = path;
  if (rest.length === 0) return { ...root, children: root.children.filter((_, idx) => idx !== i) };
  const child = root.children[i];
  if (child.kind !== "group") return root;
  return { ...root, children: root.children.map((c, idx) => (idx === i ? removeAt(child, rest) : c)) };
}

function appendAt(root: SegmentGroup, path: Path, node: SegmentNode): SegmentGroup {
  if (path.length === 0) return { ...root, children: [...root.children, node] };
  const [i, ...rest] = path;
  const child = root.children[i];
  if (child.kind !== "group") return root;
  return { ...root, children: root.children.map((c, idx) => (idx === i ? appendAt(child, rest, node) : c)) };
}

function defaultCondition(): SegmentCondition {
  return { kind: "condition", field: "superfan_score", operator: "gte", value: 1000 };
}

/* ───────────────────────── Builder ───────────────────────── */

export type SegmentBuilderProps = {
  segment?: { id: string; name: string; description: string | null; rules: SegmentGroup; cachedCount: number | null } | null;
  options: BuilderOptions;
  totalFans: number;
};

export function SegmentBuilder({ segment, options, totalFans }: SegmentBuilderProps) {
  const router = useRouter();
  const [name, setName] = React.useState(segment?.name ?? "");
  const [description, setDescription] = React.useState(segment?.description ?? "");
  const [rules, setRules] = React.useState<SegmentGroup>(segment?.rules ?? { ...EMPTY_SEGMENT, children: [defaultCondition()] });
  const [count, setCount] = React.useState<number | null>(segment?.cachedCount ?? null);
  const [counting, setCounting] = React.useState(segment?.cachedCount == null);
  const [saving, startSave] = React.useTransition();
  const complete = treeComplete(rules);
  const conditions = countConditions(rules);

  const updateRules = React.useCallback((fn: (r: SegmentGroup) => SegmentGroup) => {
    setRules(fn);
    setCounting(true);
  }, []);

  // Live count, debounced 400ms; ignores stale responses.
  React.useEffect(() => {
    if (!complete) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await previewSegmentCount({ rules });
      if (cancelled) return;
      setCounting(false);
      if (res.ok) setCount(res.data.count);
      else toast.error(res.error);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [rules, complete]);

  const save = () => {
    if (!name.trim()) {
      toast.error("Give the segment a name");
      return;
    }
    if (!complete) {
      toast.error("Fill in every condition before saving");
      return;
    }
    startSave(async () => {
      const res = await saveSegmentAction({ id: segment?.id, name: name.trim(), description: description.trim() || undefined, rules });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(segment ? "Segment updated" : "Segment created", { description: `${formatNumber(res.data.count)} fans match right now.` });
      router.push("/app/segments");
      router.refresh();
    });
  };

  const share = count != null && totalFans > 0 ? Math.round((count / totalFans) * 100) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-start">
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" htmlFor="seg-name">
              <Input id="seg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="LA superfans who bought merch" maxLength={80} autoFocus={!segment} />
            </Field>
            <Field label="Description" htmlFor="seg-desc" hint="Optional">
              <Textarea id="seg-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Who is this for and why?" maxLength={300} className="min-h-10" rows={1} />
            </Field>
          </CardContent>
        </Card>

        <GroupEditor group={rules} path={[]} depth={0} options={options} onChange={(path, node) => updateRules((r) => updateAt(r, path, node))} onRemove={(path) => updateRules((r) => removeAt(r, path))} onAppend={(path, node) => updateRules((r) => appendAt(r, path, node))} />
      </div>

      <aside className="card-surface sticky top-4 flex flex-col gap-4 p-5">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-subtle">Live audience</div>
          <div className="mt-1 flex items-baseline gap-2">
            {!complete ? (
              <span className="text-2xl font-semibold tracking-tight text-muted-foreground">Finish the rules…</span>
            ) : (
              <>
                <span className={cn("tabular text-4xl font-semibold tracking-tight transition-opacity", counting && "opacity-50")}>{count == null ? "—" : formatNumber(count)}</span>
                <span className="text-sm text-muted-foreground">fans</span>
                {counting ? <Loader2 className="size-4 animate-spin text-subtle" /> : null}
              </>
            )}
          </div>
          {share != null && complete ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {share}% of {formatNumber(totalFans)} identified fans · {conditions} {conditions === 1 ? "condition" : "conditions"}
            </p>
          ) : null}
          {complete && count != null && totalFans > 0 ? (
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(100, (count / totalFans) * 100)}%` }} />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Button type="button" variant="accent" onClick={save} loading={saving} disabled={!complete || !name.trim()}>
            {segment ? "Save changes" : "Save segment"}
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app/segments">Cancel</Link>
          </Button>
        </div>
        <p className="text-xs leading-5 text-subtle">Counts are computed live against your fan data. Saved segments cache the count and can be refreshed any time.</p>
      </aside>
    </div>
  );
}

/* ───────────────────────── Group ───────────────────────── */

type TreeCallbacks = {
  onChange: (path: Path, node: SegmentNode) => void;
  onRemove: (path: Path) => void;
  onAppend: (path: Path, node: SegmentNode) => void;
};

function GroupEditor({ group, path, depth, options, onChange, onRemove, onAppend }: { group: SegmentGroup; path: Path; depth: number; options: BuilderOptions } & TreeCallbacks) {
  const root = depth === 0;
  return (
    <div className={cn("rounded-2xl border", root ? "card-surface" : "border-border bg-muted/30", depth > 0 && "animate-rise")}>
      <div className={cn("flex flex-wrap items-center gap-2 px-4 py-3", root && "border-b border-border")}>
        {!root ? <CornerDownRight className="size-4 text-subtle" /> : null}
        <span className="text-sm text-muted-foreground">Match</span>
        <div className="inline-flex rounded-full bg-muted p-0.5">
          {(["all", "any"] as const).map((m) => (
            <button key={m} type="button" onClick={() => onChange(path, { ...group, match: m })} className={cn("rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors", group.match === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-pressed={group.match === m}>
              {m}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted-foreground">of the following</span>
        {!root ? (
          <Button type="button" variant="ghost" size="icon-sm" className="ml-auto text-subtle hover:text-danger" onClick={() => onRemove(path)} aria-label="Remove group">
            <Trash2 />
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 px-4 py-3">
        {group.children.length === 0 ? <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-subtle">No conditions — this matches every fan.</p> : null}
        {group.children.map((child, i) => {
          const childPath = [...path, i];
          return (
            <div key={i} className="flex flex-col gap-2">
              {i > 0 ? <div className="pl-2 text-[10px] font-semibold uppercase tracking-wider text-subtle">{group.match === "all" ? "and" : "or"}</div> : null}
              {child.kind === "group" ? (
                <GroupEditor group={child} path={childPath} depth={depth + 1} options={options} onChange={onChange} onRemove={onRemove} onAppend={onAppend} />
              ) : (
                <ConditionEditor condition={child} options={options} onChange={(c) => onChange(childPath, c)} onRemove={() => onRemove(childPath)} />
              )}
            </div>
          );
        })}
        <div className="mt-1 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => onAppend(path, defaultCondition())}>
            <Plus /> Add condition
          </Button>
          {depth < 2 ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onAppend(path, { kind: "group", match: group.match === "all" ? "any" : "all", children: [defaultCondition()] })}>
              <Plus /> Add group
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Condition ───────────────────────── */

function ConditionEditor({ condition, options, onChange, onRemove }: { condition: SegmentCondition; options: BuilderOptions; onChange: (c: SegmentCondition) => void; onRemove: () => void }) {
  const field = fieldByKey.get(condition.field) ?? SEGMENT_FIELDS[0];
  const showValue = needsValue(condition.operator);
  const invalid = !conditionComplete(condition);

  const setField = (key: string) => {
    const f = fieldByKey.get(key);
    if (!f) return;
    const operator = f.operators.includes(condition.operator) ? condition.operator : f.operators[0];
    onChange({ kind: "condition", field: key, operator, value: undefined });
  };

  return (
    <div className={cn("grid items-center gap-2 rounded-xl border bg-card p-2 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]", invalid ? "border-warning/40" : "border-border")}>
      <Select value={condition.field} onValueChange={setField}>
        <SelectTrigger size="sm" aria-label="Field">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {GROUPS.map((g) => (
            <SelectGroup key={g}>
              <SelectLabel>{g}</SelectLabel>
              {SEGMENT_FIELDS.filter((f) => f.group === g).map((f) => (
                <SelectItem key={f.key} value={f.key}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <Select value={condition.operator} onValueChange={(op) => onChange({ ...condition, operator: op as SegmentOperator, value: needsValue(op as SegmentOperator) ? condition.value : undefined })}>
        <SelectTrigger size="sm" aria-label="Operator">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {field.operators.map((op) => (
            <SelectItem key={op} value={op}>
              {operatorLabel(field, op)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="min-w-0">{showValue ? <ValueInput field={field} value={condition.value} options={options} onChange={(value) => onChange({ ...condition, value })} /> : <span className="block px-2 text-xs text-subtle">No value needed</span>}</div>

      <Button type="button" variant="ghost" size="icon-sm" className="justify-self-end text-subtle hover:text-danger" onClick={onRemove} aria-label="Remove condition">
        <X />
      </Button>
    </div>
  );
}

function ValueInput({ field, value, options, onChange }: { field: SegmentField; value: SegmentCondition["value"]; options: BuilderOptions; onChange: (v: SegmentCondition["value"]) => void }) {
  const str = value == null ? "" : String(value);
  switch (field.type) {
    case "number":
    case "money":
    case "days": {
      const prefix = field.type === "money" ? "$" : null;
      const suffix = field.type === "days" ? "days" : null;
      return (
        <div className="relative">
          {prefix ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-subtle">{prefix}</span> : null}
          <Input type="number" inputMode="decimal" value={str} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} className={cn("h-8 tabular text-xs", prefix && "pl-6", suffix && "pr-12")} placeholder="0" aria-label="Value" />
          {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-subtle">{suffix}</span> : null}
        </div>
      );
    }
    case "level":
      return (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger size="sm" aria-label="Level">
            <SelectValue placeholder="Choose a level" />
          </SelectTrigger>
          <SelectContent>
            {options.levels.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "tag":
      return options.tags.length === 0 ? (
        <span className="block px-2 text-xs text-subtle">No tags yet</span>
      ) : (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger size="sm" aria-label="Tag">
            <SelectValue placeholder="Choose a tag" />
          </SelectTrigger>
          <SelectContent>
            {options.tags.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="size-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "event":
      return options.events.length === 0 ? (
        <span className="block px-2 text-xs text-subtle">No events yet</span>
      ) : (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger size="sm" aria-label="Event">
            <SelectValue placeholder="Choose an event" />
          </SelectTrigger>
          <SelectContent>
            {options.events.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "source":
      return (
        <Select value={str} onValueChange={onChange}>
          <SelectTrigger size="sm" aria-label="Source">
            <SelectValue placeholder="Choose a source" />
          </SelectTrigger>
          <SelectContent>
            {SOURCES.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "boolean":
      return null;
    case "text":
    default:
      return <Input value={str} onChange={(e) => onChange(e.target.value)} className="h-8 text-xs" placeholder={field.key === "country" ? "e.g. US" : "Type a value"} aria-label="Value" />;
  }
}
