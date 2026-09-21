"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveCampaignAction } from "@/lib/actions/campaigns";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fromLocalInput, fromSelect, intOrNull, NONE, toLocalInput, toSelect } from "./form-utils";
import { useRunAction } from "./use-run-action";
import type { CampaignRow, LevelOption, LinkedOption, LinkedOptions, SegmentOption } from "./campaigns-view";

export const CAMPAIGN_TYPES = [
  { value: "challenge", label: "Challenge", hint: "Push a challenge to a specific audience.", linked: "challenges" },
  { value: "reward_drop", label: "Reward Drop", hint: "Limited reward available to the audience for a window.", linked: "rewards" },
  { value: "vip_access", label: "VIP Access", hint: "Presale, meet & greet or private content for top fans.", linked: "rewards" },
  { value: "promo_code", label: "Promo Code", hint: "Share a code with the audience, optionally tied to a reward.", linked: "rewards" },
  { value: "fan_survey", label: "Fan Survey", hint: "Ask the audience a few questions.", linked: null },
  { value: "event", label: "Event", hint: "Invite the audience to a show or meetup.", linked: "events" },
] as const;

export type CampaignType = (typeof CAMPAIGN_TYPES)[number]["value"];
type Status = "draft" | "scheduled" | "live" | "ended";

type FormState = {
  name: string;
  description: string;
  type: CampaignType;
  status: Status;
  segmentId: string;
  minimumScore: string;
  minimumLevelId: string;
  capacity: string;
  startsAt: string;
  endsAt: string;
  linkedId: string;
  code: string;
  questions: string[];
};

function readString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function readQuestions(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((q): q is string => typeof q === "string") : [];
}

function linkedIdOf(c: CampaignRow | null): string | null {
  if (!c) return null;
  return c.challengeId ?? c.rewardId ?? c.eventId ?? null;
}

function initialState(c: CampaignRow | null): FormState {
  const questions = readQuestions(c?.config.questions);
  return {
    name: c?.name ?? "",
    description: c?.description ?? "",
    type: c?.type ?? "reward_drop",
    status: c?.status ?? "draft",
    segmentId: toSelect(c?.segmentId),
    minimumScore: c?.minimumScore != null ? String(c.minimumScore) : "",
    minimumLevelId: toSelect(c?.minimumLevelId),
    capacity: c?.capacity != null ? String(c.capacity) : "",
    startsAt: toLocalInput(c?.startsAt),
    endsAt: toLocalInput(c?.endsAt),
    linkedId: toSelect(linkedIdOf(c)),
    code: readString(c?.config.code),
    questions: questions.length ? questions : [""],
  };
}

export function CampaignDialog({ open, onOpenChange, campaign, segments, levels, linked }: { open: boolean; onOpenChange: (open: boolean) => void; campaign: CampaignRow | null; segments: SegmentOption[]; levels: LevelOption[]; linked: LinkedOptions }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open ? <CampaignForm key={campaign?.id ?? "new"} campaign={campaign} segments={segments} levels={levels} linked={linked} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function CampaignForm({ campaign, segments, levels, linked, onDone }: { campaign: CampaignRow | null; segments: SegmentOption[]; levels: LevelOption[]; linked: LinkedOptions; onDone: () => void }) {
  const [form, setForm] = React.useState<FormState>(() => initialState(campaign));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { pending, run } = useRunAction();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const typeMeta = CAMPAIGN_TYPES.find((t) => t.value === form.type);
  const linkedKey = typeMeta?.linked ?? null;
  const linkedOptions: LinkedOption[] = linkedKey ? linked[linkedKey] : [];
  const linkedLabel = linkedKey === "challenges" ? "Challenge" : linkedKey === "events" ? "Event" : "Reward";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const linkedId = linkedKey ? fromSelect(form.linkedId) : null;
    const config: Record<string, unknown> = { ...campaign?.config };
    delete config.code;
    delete config.questions;
    if (form.type === "promo_code" && form.code.trim()) config.code = form.code.trim().toUpperCase();
    if (form.type === "fan_survey") config.questions = form.questions.map((q) => q.trim()).filter(Boolean);

    run(
      () =>
        saveCampaignAction({
          id: campaign?.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          type: form.type,
          status: form.status,
          segmentId: fromSelect(form.segmentId),
          minimumScore: intOrNull(form.minimumScore),
          minimumLevelId: fromSelect(form.minimumLevelId),
          capacity: intOrNull(form.capacity),
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
          challengeId: linkedKey === "challenges" ? linkedId : null,
          rewardId: linkedKey === "rewards" ? linkedId : null,
          eventId: linkedKey === "events" ? linkedId : null,
          config,
        }),
      { success: campaign ? "Campaign updated" : "Campaign created", onSuccess: onDone, onError: (_e, fieldErrors) => setErrors(fieldErrors ?? {}) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{campaign ? "Edit campaign" : "Create campaign"}</DialogTitle>
        <DialogDescription>A fan experience targeted at a saved segment. Leave the audience empty to reach every fan.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="cp-name" error={errors.name} className="sm:col-span-2">
          <Input id="cp-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="London presale drop" required autoFocus maxLength={120} />
        </Field>
        <Field label="Description" htmlFor="cp-description" error={errors.description} className="sm:col-span-2">
          <Textarea id="cp-description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What fans get and why." maxLength={1000} className="min-h-20" />
        </Field>

        <Field label="Type" error={errors.type} hint={typeMeta?.hint}>
          <Select
            value={form.type}
            onValueChange={(v) => {
              set("type", v as CampaignType);
              set("linkedId", NONE);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Status" error={errors.status}>
          <Select value={form.status} onValueChange={(v) => set("status", v as Status)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="live">Live</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        {linkedKey ? (
          <Field label={linkedLabel} error={errors.challengeId ?? errors.rewardId ?? errors.eventId} hint={linkedOptions.length === 0 ? `No ${linkedLabel.toLowerCase()}s yet — create one first.` : undefined} className="sm:col-span-2">
            <Select value={form.linkedId} onValueChange={(v) => set("linkedId", v)}>
              <SelectTrigger>
                <SelectValue placeholder={`Pick a ${linkedLabel.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {linkedOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                    <span className="ml-1.5 text-subtle">· {o.status}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}

        <Field label="Audience" error={errors.segmentId} className="sm:col-span-2">
          <Select value={form.segmentId} onValueChange={(v) => set("segmentId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="All fans" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All fans</SelectItem>
              {segments.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.cachedCount != null ? <span className="ml-1.5 text-subtle tabular">· {formatNumber(s.cachedCount)}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Minimum level" error={errors.minimumLevelId}>
          <Select value={form.minimumLevelId} onValueChange={(v) => set("minimumLevelId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Any level" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Any level</SelectItem>
              {levels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.name} · {l.minScore}+
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Minimum score" htmlFor="cp-score" error={errors.minimumScore}>
          <Input id="cp-score" type="number" min={0} inputMode="numeric" value={form.minimumScore} onChange={(e) => set("minimumScore", e.target.value)} placeholder="No minimum" className="tabular" />
        </Field>

        <Field label="Capacity" htmlFor="cp-capacity" error={errors.capacity} hint="Leave blank for unlimited.">
          <Input id="cp-capacity" type="number" min={0} inputMode="numeric" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="Unlimited" className="tabular" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Starts" htmlFor="cp-starts" error={errors.startsAt}>
            <Input id="cp-starts" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
          </Field>
          <Field label="Ends" htmlFor="cp-ends" error={errors.endsAt}>
            <Input id="cp-ends" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
          </Field>
        </div>
      </div>

      {form.type === "promo_code" ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <Field label="Promo code" htmlFor="cp-code" hint="Shown to eligible fans on their passport.">
            <Input id="cp-code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="BRIXTON26" maxLength={60} className="font-mono uppercase" />
          </Field>
        </div>
      ) : null}

      {form.type === "fan_survey" ? (
        <div className="rounded-2xl border border-border bg-muted/40 p-4">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-subtle">Survey questions</p>
          <div className="flex flex-col gap-2">
            {form.questions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 text-xs tabular text-subtle">{i + 1}.</span>
                <Input value={q} onChange={(e) => set("questions", form.questions.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder="Which city should we add?" maxLength={300} className="h-9" />
                {form.questions.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove question" onClick={() => set("questions", form.questions.filter((_, idx) => idx !== i))}>
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          {form.questions.length < 10 ? (
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => set("questions", [...form.questions, ""])}>
              <Plus className="size-3.5" /> Add question
            </Button>
          ) : null}
        </div>
      ) : null}

      <DialogFooter className="mt-0">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {campaign ? "Save changes" : "Create campaign"}
        </Button>
      </DialogFooter>
    </form>
  );
}
