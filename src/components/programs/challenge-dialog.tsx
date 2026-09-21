"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ChallengeConfig } from "@/db/schema";
import { saveChallengeAction } from "@/lib/actions/challenges";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { fromLocalInput, fromSelect, intOr, intOrNull, newId, NONE, toLocalInput, toSelect } from "./form-utils";
import { useRunAction } from "./use-run-action";
import type { ChallengeRow, EventOption } from "./challenges-view";

export const CHALLENGE_TYPES = [
  { value: "quiz", label: "Quiz", hint: "Fans answer questions; a pass score awards the points." },
  { value: "promo_code", label: "Promo code", hint: "Fans enter a secret code from merch, vinyl or a show." },
  { value: "link_visit", label: "Link visit", hint: "Fans open a link (new single, video, pre-save)." },
  { value: "form_submission", label: "Form", hint: "Collect answers: RSVPs, requests, feedback." },
  { value: "event_checkin", label: "Event check-in", hint: "Completed when a fan checks in at the selected show." },
  { value: "purchase", label: "Purchase", hint: "Completed by a merch order above a minimum amount." },
  { value: "referral", label: "Referral", hint: "Completed after a number of successful referrals." },
  { value: "manual", label: "Manual", hint: "Your team marks completions from the fan profile." },
] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number]["value"];
type Status = "draft" | "active" | "ended" | "archived";

type QuizQuestion = { id: string; question: string; options: string[]; answerIndex: number };
type FormField = { key: string; label: string; type: "text" | "textarea" | "select"; required: boolean; options: string };

type FormState = {
  title: string;
  description: string;
  type: ChallengeType;
  status: Status;
  points: string;
  isMajor: boolean;
  imageUrl: string;
  startsAt: string;
  endsAt: string;
  maxCompletions: string;
  // type-specific
  questions: QuizQuestion[];
  passScore: string;
  code: string;
  url: string;
  fields: FormField[];
  eventId: string;
  minimumAmount: string;
  referralsRequired: string;
};

function newQuestion(): QuizQuestion {
  return { id: newId(), question: "", options: ["", ""], answerIndex: 0 };
}

function newField(): FormField {
  return { key: "", label: "", type: "text", required: true, options: "" };
}

function initialState(challenge: ChallengeRow | null): FormState {
  const cfg: ChallengeConfig = challenge?.config ?? {};
  return {
    title: challenge?.title ?? "",
    description: challenge?.description ?? "",
    type: challenge?.type ?? "quiz",
    status: challenge?.status ?? "draft",
    points: challenge ? String(challenge.points) : "100",
    isMajor: challenge?.isMajor ?? false,
    imageUrl: challenge?.imageUrl ?? "",
    startsAt: toLocalInput(challenge?.startsAt),
    endsAt: toLocalInput(challenge?.endsAt),
    maxCompletions: challenge?.maxCompletions != null ? String(challenge.maxCompletions) : "",
    questions: cfg.questions?.length ? cfg.questions.map((q) => ({ ...q, options: [...q.options] })) : [newQuestion()],
    passScore: cfg.passScore != null ? String(cfg.passScore) : "",
    code: cfg.code ?? "",
    url: cfg.url ?? "",
    fields: cfg.fields?.length ? cfg.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required ?? false, options: (f.options ?? []).join(", ") })) : [newField()],
    eventId: toSelect(cfg.eventId),
    minimumAmount: cfg.minimumAmountCents != null ? String(cfg.minimumAmountCents / 100) : "",
    referralsRequired: cfg.referralsRequired != null ? String(cfg.referralsRequired) : "1",
  };
}

function buildConfig(form: FormState): ChallengeConfig {
  switch (form.type) {
    case "quiz": {
      const questions = form.questions
        .map((q) => ({ id: q.id, question: q.question.trim(), options: q.options.map((o) => o.trim()).filter(Boolean), answerIndex: q.answerIndex }))
        .filter((q) => q.question);
      const pass = intOrNull(form.passScore);
      return { questions, passScore: pass ?? undefined };
    }
    case "promo_code":
      return { code: form.code.trim() };
    case "link_visit":
      return form.url.trim() ? { url: form.url.trim() } : {};
    case "form_submission":
      return {
        fields: form.fields
          .filter((f) => f.label.trim())
          .map((f) => ({
            key: (f.key.trim() || f.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")).slice(0, 40),
            label: f.label.trim(),
            type: f.type,
            required: f.required,
            options: f.type === "select" ? f.options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
          })),
      };
    case "event_checkin":
      return { eventId: fromSelect(form.eventId) ?? undefined };
    case "purchase": {
      const dollars = Number(form.minimumAmount);
      return { minimumAmountCents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0 };
    }
    case "referral":
      return { referralsRequired: intOr(form.referralsRequired, 1) };
    case "manual":
    default:
      return {};
  }
}

export function ChallengeDialog({ open, onOpenChange, challenge, events }: { open: boolean; onOpenChange: (open: boolean) => void; challenge: ChallengeRow | null; events: EventOption[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open ? <ChallengeForm key={challenge?.id ?? "new"} challenge={challenge} events={events} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ChallengeForm({ challenge, events, onDone }: { challenge: ChallengeRow | null; events: EventOption[]; onDone: () => void }) {
  const [form, setForm] = React.useState<FormState>(() => initialState(challenge));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { pending, run } = useRunAction();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const typeMeta = CHALLENGE_TYPES.find((t) => t.value === form.type);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    run(
      () =>
        saveChallengeAction({
          id: challenge?.id,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          type: form.type,
          status: form.status,
          points: intOr(form.points, 0),
          isMajor: form.isMajor,
          imageUrl: form.imageUrl.trim(),
          config: buildConfig(form),
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
          maxCompletions: intOrNull(form.maxCompletions),
        }),
      { success: challenge ? "Challenge updated" : "Challenge created", onSuccess: onDone, onError: (_e, fieldErrors) => setErrors(fieldErrors ?? {}) },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{challenge ? "Edit challenge" : "Create challenge"}</DialogTitle>
        <DialogDescription>Fans earn Reward Points when they complete it. Major challenges also count more toward the Superfan Score.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" htmlFor="ch-title" error={errors.title} className="sm:col-span-2">
          <Input id="ch-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="How well do you know Afterlight?" required autoFocus maxLength={120} />
        </Field>
        <Field label="Description" htmlFor="ch-description" error={errors.description} className="sm:col-span-2">
          <Textarea id="ch-description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Shown on the fan's passport." maxLength={1000} className="min-h-20" />
        </Field>

        <Field label="Type" error={errors.type} hint={typeMeta?.hint}>
          <Select value={form.type} onValueChange={(v) => set("type", v as ChallengeType)} disabled={Boolean(challenge)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHALLENGE_TYPES.map((t) => (
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
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Points" htmlFor="ch-points" error={errors.points}>
          <Input id="ch-points" type="number" min={0} max={100000} inputMode="numeric" value={form.points} onChange={(e) => set("points", e.target.value)} required className="tabular" />
        </Field>
        <Field label="Max completions" htmlFor="ch-max" error={errors.maxCompletions} hint="Leave blank for unlimited.">
          <Input id="ch-max" type="number" min={1} inputMode="numeric" value={form.maxCompletions} onChange={(e) => set("maxCompletions", e.target.value)} placeholder="Unlimited" className="tabular" />
        </Field>

        <Field label="Starts" htmlFor="ch-starts" error={errors.startsAt}>
          <Input id="ch-starts" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </Field>
        <Field label="Ends" htmlFor="ch-ends" error={errors.endsAt}>
          <Input id="ch-ends" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </Field>

        <Field label="Image URL" htmlFor="ch-image" error={errors.imageUrl}>
          <Input id="ch-image" type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
        </Field>
        <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
          <div>
            <p className="text-sm font-medium">Major challenge</p>
            <p className="text-xs text-muted-foreground">Counts more toward the Superfan Score.</p>
          </div>
          <Switch checked={form.isMajor} onCheckedChange={(v) => set("isMajor", v)} aria-label="Major challenge" />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-muted/40 p-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-subtle">{typeMeta?.label} setup</p>
        <ConfigEditor form={form} set={set} events={events} errors={errors} />
      </div>

      <DialogFooter className="mt-0">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {challenge ? "Save changes" : "Create challenge"}
        </Button>
      </DialogFooter>
    </form>
  );
}

type Setter = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function ConfigEditor({ form, set, events, errors }: { form: FormState; set: Setter; events: EventOption[]; errors: Record<string, string> }) {
  switch (form.type) {
    case "quiz":
      return <QuizEditor questions={form.questions} passScore={form.passScore} onChange={(q) => set("questions", q)} onPassScore={(v) => set("passScore", v)} />;
    case "promo_code":
      return (
        <Field label="Promo code" htmlFor="cfg-code" error={errors["config.code"]} hint="Case-insensitive. Fans type this on their passport.">
          <Input id="cfg-code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="AFTERLIGHT" maxLength={60} className="font-mono uppercase" required />
        </Field>
      );
    case "link_visit":
      return (
        <Field label="Link" htmlFor="cfg-url" error={errors["config.url"]}>
          <Input id="cfg-url" type="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://…" required />
        </Field>
      );
    case "form_submission":
      return <FieldsEditor fields={form.fields} onChange={(f) => set("fields", f)} />;
    case "event_checkin":
      return (
        <Field label="Event" error={errors["config.eventId"]} hint={events.length === 0 ? "Create an event first." : undefined}>
          <Select value={form.eventId} onValueChange={(v) => set("eventId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Pick an event" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Pick an event…</SelectItem>
              {events.map((ev) => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.city ? ` · ${ev.city}` : ""} · {formatDate(ev.startsAt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      );
    case "purchase":
      return (
        <Field label="Minimum order ($)" htmlFor="cfg-min" error={errors["config.minimumAmountCents"]} hint="0 means any order qualifies.">
          <Input id="cfg-min" type="number" min={0} step="0.01" inputMode="decimal" value={form.minimumAmount} onChange={(e) => set("minimumAmount", e.target.value)} placeholder="0" className="tabular" />
        </Field>
      );
    case "referral":
      return (
        <Field label="Referrals required" htmlFor="cfg-ref" error={errors["config.referralsRequired"]}>
          <Input id="cfg-ref" type="number" min={1} max={100} inputMode="numeric" value={form.referralsRequired} onChange={(e) => set("referralsRequired", e.target.value)} className="tabular" required />
        </Field>
      );
    case "manual":
    default:
      return <p className="text-sm text-muted-foreground">Nothing to configure. Your team approves completions from a fan&apos;s profile.</p>;
  }
}

function QuizEditor({ questions, passScore, onChange, onPassScore }: { questions: QuizQuestion[]; passScore: string; onChange: (q: QuizQuestion[]) => void; onPassScore: (v: string) => void }) {
  const update = (id: string, patch: Partial<QuizQuestion>) => onChange(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  return (
    <div className="flex flex-col gap-4">
      {questions.map((q, qi) => (
        <div key={q.id} className="rounded-xl border border-border bg-card p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <Label>Question {qi + 1}</Label>
            {questions.length > 1 ? (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove question" onClick={() => onChange(questions.filter((x) => x.id !== q.id))}>
                <Trash2 className="size-3.5" />
              </Button>
            ) : null}
          </div>
          <Input value={q.question} onChange={(e) => update(q.id, { question: e.target.value })} placeholder="What city was Afterlight recorded in?" maxLength={300} required />
          <div className="mt-3 flex flex-col gap-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`answer-${q.id}`}
                  checked={q.answerIndex === oi}
                  onChange={() => update(q.id, { answerIndex: oi })}
                  className="size-4 accent-[var(--accent)]"
                  aria-label={`Mark option ${oi + 1} as correct`}
                />
                <Input
                  value={opt}
                  onChange={(e) => update(q.id, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                  placeholder={`Option ${oi + 1}`}
                  maxLength={120}
                  className="h-9"
                  required
                />
                {q.options.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove option"
                    onClick={() => update(q.id, { options: q.options.filter((_, i) => i !== oi), answerIndex: q.answerIndex >= oi && q.answerIndex > 0 ? q.answerIndex - 1 : q.answerIndex })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-subtle">Select the radio next to the correct answer.</p>
            {q.options.length < 6 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => update(q.id, { options: [...q.options, ""] })}>
                <Plus className="size-3.5" /> Option
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        {questions.length < 20 ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...questions, newQuestion()])}>
            <Plus className="size-3.5" /> Add question
          </Button>
        ) : (
          <span />
        )}
        <Field label="Pass score" htmlFor="cfg-pass" hint={`Correct answers needed (max ${questions.length}). Blank = all.`} className="sm:w-56">
          <Input id="cfg-pass" type="number" min={1} max={questions.length} inputMode="numeric" value={passScore} onChange={(e) => onPassScore(e.target.value)} placeholder={String(questions.length)} className="tabular" />
        </Field>
      </div>
    </div>
  );
}

function FieldsEditor({ fields, onChange }: { fields: FormField[]; onChange: (f: FormField[]) => void }) {
  const update = (i: number, patch: Partial<FormField>) => onChange(fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  return (
    <div className="flex flex-col gap-3">
      {fields.map((f, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-3.5">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_8rem]">
            <Field label="Label">
              <Input value={f.label} onChange={(e) => update(i, { label: e.target.value })} placeholder="Which city?" maxLength={120} required className="h-9" />
            </Field>
            <Field label="Key" hint="Auto-generated from the label if blank.">
              <Input value={f.key} onChange={(e) => update(i, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() })} placeholder="city" maxLength={40} className="h-9 font-mono" />
            </Field>
            <Field label="Type">
              <Select value={f.type} onValueChange={(v) => update(i, { type: v as FormField["type"] })}>
                <SelectTrigger size="sm" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="textarea">Long text</SelectItem>
                  <SelectItem value="select">Select</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {f.type === "select" ? (
            <Field label="Options" hint="Comma separated." className="mt-3">
              <Input value={f.options} onChange={(e) => update(i, { options: e.target.value })} placeholder="Los Angeles, New York, London" className="h-9" />
            </Field>
          ) : null}
          <div className="mt-3 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={f.required} onCheckedChange={(v) => update(i, { required: v })} /> Required
            </label>
            {fields.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(fields.filter((_, idx) => idx !== i))}>
                <Trash2 className="size-3.5" /> Remove
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      {fields.length < 12 ? (
        <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onChange([...fields, newField()])}>
          <Plus className="size-3.5" /> Add field
        </Button>
      ) : null}
    </div>
  );
}
