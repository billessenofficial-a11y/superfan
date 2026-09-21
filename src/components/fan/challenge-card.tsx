"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, HelpCircle, KeyRound, Link2, ListChecks, QrCode, ShoppingBag, UserCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/toast";
import type { ChallengeConfig } from "@/db/schema";
import { completeChallengeAction } from "@/lib/actions/fan";
import type { ChallengeSubmission } from "@/lib/challenges/complete";
import { cn, formatDate, formatMoney, formatNumber } from "@/lib/utils";

export type ChallengeCardData = {
  id: string;
  title: string;
  description: string | null;
  type: "manual" | "quiz" | "referral" | "event_checkin" | "promo_code" | "link_visit" | "form_submission" | "purchase";
  points: number;
  isMajor: boolean;
  imageUrl: string | null;
  config: ChallengeConfig;
  endsAt: Date | null;
};

export type ChallengeContext = {
  slug: string;
  checkedInEventIds: string[];
  qualifiedReferrals: number;
  lifetimeSpendCents: number;
  referralLink: string;
};

const TYPE_META: Record<ChallengeCardData["type"], { label: string; icon: React.ReactNode }> = {
  manual: { label: "Awarded by the artist", icon: <UserCheck /> },
  quiz: { label: "Quiz", icon: <HelpCircle /> },
  referral: { label: "Referral", icon: <Users /> },
  event_checkin: { label: "Show check-in", icon: <QrCode /> },
  promo_code: { label: "Promo code", icon: <KeyRound /> },
  link_visit: { label: "Visit a link", icon: <Link2 /> },
  form_submission: { label: "Form", icon: <ListChecks /> },
  purchase: { label: "Purchase", icon: <ShoppingBag /> },
};

export function ChallengeCard({ challenge, completed, completedAt, ctx }: { challenge: ChallengeCardData; completed: boolean; completedAt: Date | null; ctx: ChallengeContext }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [expanded, setExpanded] = React.useState(false);
  const meta = TYPE_META[challenge.type];

  const submit = (submission?: ChallengeSubmission) =>
    start(async () => {
      const res = await completeChallengeAction({ slug: ctx.slug, challengeId: challenge.id, submission });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const extras = [res.data.levelUp && res.data.levelName ? `Level up: ${res.data.levelName}` : null, ...res.data.newBadges.map((b) => `New badge: ${b}`)].filter(Boolean).join(" · ");
      toast.success(`Challenge complete · +${formatNumber(res.data.points)} points`, { description: extras || (res.data.scoreDelta > 0 ? `+${formatNumber(res.data.scoreDelta)} Superfan Score` : undefined) });
      setExpanded(false);
      router.refresh();
    });

  return (
    <li className={cn("card-surface overflow-hidden", completed && "opacity-80")}>
      {challenge.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={challenge.imageUrl} alt="" className="h-28 w-full object-cover" />
      ) : null}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl [&>svg]:size-4", completed ? "bg-success-soft text-success" : "bg-artist/10 text-artist")}>{completed ? <CheckCircle2 /> : meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-tight">{challenge.title}</p>
              <Badge variant={completed ? "success" : "artist"} className="tabular shrink-0">
                +{formatNumber(challenge.points)} pts
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-subtle">
              {meta.label}
              {challenge.isMajor ? " · Major" : ""}
              {challenge.endsAt ? ` · Ends ${formatDate(challenge.endsAt)}` : ""}
            </p>
            {challenge.description ? <p className="mt-2 text-xs text-muted-foreground">{challenge.description}</p> : null}
          </div>
        </div>

        <div className="mt-3 pl-12">
          {completed ? (
            <p className="text-xs font-medium text-success">Completed{completedAt ? ` ${formatDate(completedAt, { month: "short", day: "numeric", year: "numeric" })}` : ""}</p>
          ) : (
            <Flow challenge={challenge} ctx={ctx} pending={pending} expanded={expanded} setExpanded={setExpanded} submit={submit} />
          )}
        </div>
      </div>
    </li>
  );
}

function Flow({ challenge, ctx, pending, expanded, setExpanded, submit }: { challenge: ChallengeCardData; ctx: ChallengeContext; pending: boolean; expanded: boolean; setExpanded: (v: boolean) => void; submit: (s?: ChallengeSubmission) => void }) {
  const cfg = challenge.config;
  switch (challenge.type) {
    case "manual":
      return <p className="text-xs text-muted-foreground">Awarded by the artist when you complete it. Nothing to submit here.</p>;

    case "quiz":
      return expanded ? (
        <QuizForm questions={cfg.questions ?? []} pending={pending} onSubmit={(answers) => submit({ answers })} onCancel={() => setExpanded(false)} />
      ) : (
        <Button size="sm" variant="artist" onClick={() => setExpanded(true)}>
          Start quiz
        </Button>
      );

    case "promo_code":
      return <PromoForm pending={pending} onSubmit={(code) => submit({ code })} />;

    case "link_visit":
      return <LinkVisit url={cfg.url ?? "#"} pending={pending} onConfirm={() => submit({ visited: true })} />;

    case "form_submission":
      return expanded ? (
        <FieldsForm fields={cfg.fields ?? []} pending={pending} onSubmit={(fields) => submit({ fields })} onCancel={() => setExpanded(false)} />
      ) : (
        <Button size="sm" variant="artist" onClick={() => setExpanded(true)}>
          Fill in the form
        </Button>
      );

    case "event_checkin": {
      const done = cfg.eventId ? ctx.checkedInEventIds.includes(cfg.eventId) : false;
      return done ? (
        <Button size="sm" variant="artist" loading={pending} onClick={() => submit()}>
          Claim points
        </Button>
      ) : (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <QrCode className="size-3.5" /> Check in at the show to complete this.
        </p>
      );
    }

    case "referral": {
      const required = cfg.referralsRequired ?? 1;
      const have = ctx.qualifiedReferrals;
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              <span className="tabular font-medium text-foreground">{Math.min(have, required)}</span> of {required} {required === 1 ? "friend" : "friends"} qualified
            </span>
            {have >= required ? (
              <Button size="sm" variant="artist" loading={pending} onClick={() => submit()}>
                Claim points
              </Button>
            ) : (
              <Link href="#referral" className="text-xs font-medium text-artist hover:underline">
                Share your link
              </Link>
            )}
          </div>
          <Progress value={have} max={required} size="sm" color="var(--artist-accent)" />
        </div>
      );
    }

    case "purchase": {
      const min = cfg.minimumAmountCents ?? 1;
      const ok = ctx.lifetimeSpendCents >= min;
      return ok ? (
        <Button size="sm" variant="artist" loading={pending} onClick={() => submit()}>
          Claim points
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Spend {formatMoney(min)} or more on merch to complete this. Purchases sync automatically.</p>
      );
    }
  }
}

function QuizForm({ questions, pending, onSubmit, onCancel }: { questions: NonNullable<ChallengeConfig["questions"]>; pending: boolean; onSubmit: (answers: Record<string, number>) => void; onCancel: () => void }) {
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const complete = questions.every((q) => answers[q.id] != null);
  return (
    <form
      className="space-y-4 rounded-2xl bg-muted p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(answers);
      }}
    >
      {questions.length === 0 ? <p className="text-xs text-muted-foreground">This quiz has no questions yet. Submit to complete it.</p> : null}
      {questions.map((q, qi) => (
        <fieldset key={q.id}>
          <legend className="text-sm font-medium">
            {qi + 1}. {q.question}
          </legend>
          <div className="mt-2 space-y-1.5">
            {q.options.map((opt, i) => (
              <label key={i} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border transition-colors", answers[q.id] === i && "ring-2 ring-artist")}>
                <input type="radio" name={q.id} className="accent-[var(--artist-accent)]" checked={answers[q.id] === i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} />
                {opt}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="artist" loading={pending} disabled={!complete}>
          Submit answers
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function PromoForm({ pending, onSubmit }: { pending: boolean; onSubmit: (code: string) => void }) {
  const [code, setCode] = React.useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
    >
      <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" className="h-9 font-mono uppercase" autoCapitalize="characters" autoComplete="off" />
      <Button type="submit" size="sm" variant="artist" className="h-9 shrink-0" loading={pending} disabled={!code.trim()}>
        Redeem
      </Button>
    </form>
  );
}

function LinkVisit({ url, pending, onConfirm }: { url: string; pending: boolean; onConfirm: () => void }) {
  const [visited, setVisited] = React.useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button asChild size="sm" variant={visited ? "secondary" : "artist"}>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => setVisited(true)}>
          Open link <ExternalLink className="size-3.5" />
        </a>
      </Button>
      {visited ? (
        <Button size="sm" variant="artist" loading={pending} onClick={onConfirm}>
          I visited
        </Button>
      ) : null}
    </div>
  );
}

function FieldsForm({ fields, pending, onSubmit, onCancel }: { fields: NonNullable<ChallengeConfig["fields"]>; pending: boolean; onSubmit: (fields: Record<string, string>) => void; onCancel: () => void }) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const set = (key: string, v: string) => setValues((s) => ({ ...s, [key]: v }));
  return (
    <form
      className="space-y-3 rounded-2xl bg-muted p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(values);
      }}
    >
      {fields.map((f) => (
        <Field key={f.key} label={`${f.label}${f.required ? " *" : ""}`} htmlFor={`f-${f.key}`}>
          {f.type === "textarea" ? (
            <Textarea id={`f-${f.key}`} required={f.required} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          ) : f.type === "select" ? (
            <select id={`f-${f.key}`} required={f.required} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30">
              <option value="" disabled>
                Choose…
              </option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <Input id={`f-${f.key}`} required={f.required} value={values[f.key] ?? ""} onChange={(e) => set(f.key, e.target.value)} />
          )}
        </Field>
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="artist" loading={pending}>
          Submit
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
