"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, CalendarRange, Loader2, MoreHorizontal, Pencil, Play, Plus, Square, Star, Target, Undo2, Users } from "lucide-react";
import type { challenges } from "@/db/schema";
import { setChallengeStatusAction } from "@/lib/actions/challenges";
import { listChallengeCompletionsAction } from "@/lib/actions/challenges-extra";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogDescription, DialogTitle, SheetContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/components/ui/toast";
import { CHALLENGE_TYPES, ChallengeDialog } from "./challenge-dialog";
import { fanName } from "./form-utils";
import { StatusBadge } from "./status-badge";
import { useRunAction } from "./use-run-action";

export type ChallengeRow = typeof challenges.$inferSelect & { completions: number };
export type EventOption = { id: string; name: string; city: string | null; startsAt: Date };

type Completion = { id: string; fanId: string; firstName: string | null; lastName: string | null; email: string | null; avatarUrl: string | null; pointsAwarded: number; completedAt: Date };

export function ChallengesView({ challenges, events, canManage }: { challenges: ChallengeRow[]; events: EventOption[]; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ChallengeRow | null>(null);
  const [completionsFor, setCompletionsFor] = React.useState<ChallengeRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const active = challenges.filter((c) => c.status === "active");
  const totalCompletions = challenges.reduce((s, c) => s + c.completions, 0);

  return (
    <div>
      <PageHeader
        title="Challenges"
        description={challenges.length ? `${formatNumber(active.length)} active · ${formatNumber(totalCompletions)} completions` : "Ways for fans to earn Reward Points."}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus /> Create challenge
            </Button>
          ) : null
        }
      />

      {challenges.length === 0 ? (
        <EmptyState
          icon={<Target />}
          title="Turn fandom into a game."
          description="Quizzes, promo codes, referrals, show check-ins and more. Fans earn points and level up."
          actions={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus /> Create Challenge
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              canManage={canManage}
              onEdit={() => {
                setEditing(c);
                setDialogOpen(true);
              }}
              onCompletions={() => setCompletionsFor(c)}
            />
          ))}
        </div>
      )}

      <ChallengeDialog open={dialogOpen} onOpenChange={setDialogOpen} challenge={editing} events={events} />
      <CompletionsSheet challenge={completionsFor} onOpenChange={(open) => !open && setCompletionsFor(null)} />
    </div>
  );
}

function ChallengeCard({ challenge, canManage, onEdit, onCompletions }: { challenge: ChallengeRow; canManage: boolean; onEdit: () => void; onCompletions: () => void }) {
  const { pending, run } = useRunAction();
  const setStatus = (status: "draft" | "active" | "ended" | "archived") => run(() => setChallengeStatusAction({ id: challenge.id, status }), { success: `Challenge ${status === "active" ? "activated" : status}` });
  const type = CHALLENGE_TYPES.find((t) => t.value === challenge.type)?.label ?? challenge.type;
  const capacity = challenge.maxCompletions;

  return (
    <Card className={cn("flex flex-col overflow-hidden animate-rise", pending && "opacity-60")}>
      {challenge.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={challenge.imageUrl} alt="" className="h-36 w-full object-cover" loading="lazy" />
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline">{type}</Badge>
              {challenge.isMajor ? (
                <Badge variant="accent">
                  <Star /> Major
                </Badge>
              ) : null}
            </div>
            <h3 className="mt-2 truncate text-sm font-semibold tracking-tight">{challenge.title}</h3>
            {challenge.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{challenge.description}</p> : null}
          </div>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Challenge actions" className="-mr-2 -mt-1 shrink-0">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onCompletions}>
                  <Users /> View completions
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {challenge.status !== "active" ? (
                  <DropdownMenuItem onSelect={() => setStatus("active")}>
                    <Play /> Activate
                  </DropdownMenuItem>
                ) : null}
                {challenge.status === "active" ? (
                  <DropdownMenuItem onSelect={() => setStatus("ended")}>
                    <Square /> End
                  </DropdownMenuItem>
                ) : null}
                {challenge.status === "ended" ? (
                  <DropdownMenuItem onSelect={() => setStatus("draft")}>
                    <Undo2 /> Back to draft
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onSelect={() => setStatus("archived")} destructive>
                  <Archive /> Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1">
            <span className="tabular text-3xl font-semibold tracking-tight text-accent">+{formatNumber(challenge.points)}</span>
            <span className="text-xs font-medium text-muted-foreground">pts</span>
          </div>
          <button type="button" onClick={onCompletions} className="group inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Users className="size-3.5" />
            <span className="tabular">
              {formatNumber(challenge.completions)}
              {capacity != null ? ` / ${formatNumber(capacity)}` : ""}
            </span>
            <span className="hidden group-hover:inline">completions</span>
          </button>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2">
          <StatusBadge status={challenge.status} />
          <span className="inline-flex items-center gap-1 text-[11px] text-subtle">
            <CalendarRange className="size-3" />
            {challenge.startsAt || challenge.endsAt ? `${challenge.startsAt ? formatDate(challenge.startsAt) : "Now"} → ${challenge.endsAt ? formatDate(challenge.endsAt) : "no end"}` : "No time limit"}
          </span>
        </div>
      </div>
    </Card>
  );
}

function CompletionsSheet({ challenge, onOpenChange }: { challenge: ChallengeRow | null; onOpenChange: (open: boolean) => void }) {
  const open = Boolean(challenge);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent className="p-6">{challenge ? <CompletionsBody key={challenge.id} challenge={challenge} /> : null}</SheetContent>
    </Dialog>
  );
}

function CompletionsBody({ challenge }: { challenge: ChallengeRow }) {
  const [rows, setRows] = React.useState<Completion[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listChallengeCompletionsAction({ challengeId: challenge.id }).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error(res.error);
        setRows([]);
        return;
      }
      setRows(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [challenge.id]);

  return (
    <div className="flex flex-col gap-4 pr-6">
      <div>
        <DialogTitle>Completions</DialogTitle>
        <DialogDescription className="mt-1 line-clamp-2">{challenge.title}</DialogDescription>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span className="tabular font-semibold">{formatNumber(challenge.completions)}</span>
        <span className="text-muted-foreground">fans completed · +{formatNumber(challenge.points)} pts each</span>
      </div>
      {rows == null ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState compact icon={<Users />} title="No completions yet" description="Fans who complete this challenge appear here." />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {rows.map((r) => {
            const name = fanName(r);
            return (
              <li key={r.id}>
                <Link href={`/app/fans/${r.fanId}`} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted">
                  <Avatar src={r.avatarUrl} name={name} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="truncate text-xs text-muted-foreground">{formatDateTime(r.completedAt)}</p>
                  </div>
                  <span className="tabular text-xs font-medium text-accent">+{formatNumber(r.pointsAwarded)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
