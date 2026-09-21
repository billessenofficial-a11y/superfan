"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, MinusCircle, MoreHorizontal, Plus, PlusCircle, ShieldCheck, StickyNote, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { addNoteAction, adjustPointsAction, adjustScoreAction, createTagAction, toggleTagAction, verifyAttendanceAction } from "@/lib/actions/fans";
import type { ActionResult } from "@/lib/actions/result";
import { DIMENSIONS, type ScoreDimension } from "@/lib/scoring/defaults";
import { cn, formatDate } from "@/lib/utils";

type DialogKind = "add_points" | "remove_points" | "adjust_score" | "note" | "verify" | "tags" | null;

export type FanActionsProps = {
  fanId: string;
  fanName: string;
  instagramUsername: string | null;
  allTags: { id: string; name: string; color: string }[];
  assignedTagIds: string[];
  events: { id: string; name: string; city: string | null; startsAt: Date; attended: boolean }[];
  canEdit: boolean;
  canAdjust: boolean;
};

/**
 * Action bar + dialogs for the artist-side fan profile. Each dialog's form is
 * mounted inside `DialogContent`, so its state resets naturally on close.
 */
export function FanActions(props: FanActionsProps) {
  const [dialog, setDialog] = React.useState<DialogKind>(null);
  const close = () => setDialog(null);
  const { canEdit, canAdjust } = props;
  if (!canEdit && !canAdjust && !props.instagramUsername) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canAdjust ? (
        <Button type="button" variant="accent" size="sm" onClick={() => setDialog("add_points")}>
          <PlusCircle /> Add points
        </Button>
      ) : null}
      {canEdit ? (
        <>
          <Button type="button" variant="secondary" size="sm" onClick={() => setDialog("note")}>
            <StickyNote /> Add note
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={() => setDialog("tags")}>
            <Tag /> Tag
          </Button>
        </>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="icon-sm" aria-label="More actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canAdjust ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog("remove_points")}>
                <MinusCircle /> Remove points
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("adjust_score")}>
                <ShieldCheck /> Adjust score
              </DropdownMenuItem>
            </>
          ) : null}
          {canEdit ? (
            <DropdownMenuItem onSelect={() => setDialog("verify")}>
              <Check /> Verify attendance
            </DropdownMenuItem>
          ) : null}
          {props.instagramUsername ? (
            <>
              {(canEdit || canAdjust) && <DropdownMenuSeparator />}
              <DropdownMenuItem asChild>
                <a href={`https://instagram.com/${props.instagramUsername}`} target="_blank" rel="noreferrer noopener">
                  <ExternalLink /> Open Instagram profile
                </a>
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "add_points" || dialog === "remove_points"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <PointsForm mode={dialog === "remove_points" ? "remove" : "add"} onClose={close} fanId={props.fanId} fanName={props.fanName} />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "adjust_score"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <ScoreForm onClose={close} fanId={props.fanId} fanName={props.fanName} />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "note"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <NoteForm onClose={close} fanId={props.fanId} />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "verify"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <VerifyForm onClose={close} fanId={props.fanId} events={props.events} />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "tags"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <TagsForm onClose={close} fanId={props.fanId} allTags={props.allTags} assignedTagIds={props.assignedTagIds} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function useAction() {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = <T,>(fn: () => Promise<ActionResult<T>>, onOk: (data: T) => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onOk(res.data);
      router.refresh();
    });
  return { pending, run };
}

/* ───────────────────────── Points ───────────────────────── */

function PointsForm({ mode, onClose, fanId, fanName }: { mode: "add" | "remove"; onClose: () => void; fanId: string; fanName: string }) {
  const { pending, run } = useAction();
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const n = Math.abs(Math.round(Number(amount)));
  const valid = n > 0 && reason.trim().length >= 3;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{mode === "add" ? "Add reward points" : "Remove reward points"}</DialogTitle>
        <DialogDescription>
          {mode === "add" ? "Points are spendable on rewards. " : "Removing points reduces the fan's spendable balance. "}
          This is recorded in the audit log with your reason.
        </DialogDescription>
      </DialogHeader>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          run(
            () => adjustPointsAction({ fanId, amount: mode === "add" ? n : -n, reason: reason.trim() }),
            (d) => {
              toast.success(`${mode === "add" ? "Added" : "Removed"} ${n.toLocaleString()} points`, { description: `${fanName} now has ${d.balance.toLocaleString()} points.` });
              onClose();
            },
          );
        }}
      >
        <Field label="Amount" htmlFor="pts-amount">
          <Input id="pts-amount" type="number" min={1} max={100000} step={1} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 250" className="tabular" autoFocus required />
        </Field>
        <Field label="Reason" htmlFor="pts-reason" hint="Required. Shown in the fan's point history.">
          <Textarea id="pts-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === "add" ? "Helped at the merch table" : "Duplicate award reversal"} maxLength={300} className="min-h-20" required />
        </Field>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={mode === "add" ? "accent" : "danger"} loading={pending} disabled={!valid}>
            {mode === "add" ? "Add points" : "Remove points"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/* ───────────────────────── Score ───────────────────────── */

const DIMENSION_LABELS: Record<ScoreDimension, string> = { commerce: "Commerce", attendance: "Attendance", engagement: "Engagement", advocacy: "Advocacy", community: "Community" };

function ScoreForm({ onClose, fanId, fanName }: { onClose: () => void; fanId: string; fanName: string }) {
  const { pending, run } = useAction();
  const [points, setPoints] = React.useState("");
  const [dimension, setDimension] = React.useState<ScoreDimension>("community");
  const [reason, setReason] = React.useState("");
  const n = Math.round(Number(points));
  const valid = Number.isFinite(n) && n !== 0 && reason.trim().length >= 3;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Adjust Superfan Score</DialogTitle>
        <DialogDescription>Adds raw points to one dimension. The Superfan Score is not spendable; use a negative number to subtract.</DialogDescription>
      </DialogHeader>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          run(
            () => adjustScoreAction({ fanId, points: n, dimension, reason: reason.trim() }),
            (d) => {
              toast.success("Score adjusted", { description: `${fanName}'s score is now ${d.score.toLocaleString()}.` });
              onClose();
            },
          );
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Points" htmlFor="score-points" hint="Positive or negative">
            <Input id="score-points" type="number" min={-100000} max={100000} step={1} inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="e.g. 200" className="tabular" autoFocus required />
          </Field>
          <Field label="Dimension">
            <Select value={dimension} onValueChange={(v) => setDimension(v as ScoreDimension)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIMENSIONS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIMENSION_LABELS[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Reason" htmlFor="score-reason" hint="Required. Appears on the fan's timeline as an artist-verified event.">
          <Textarea id="score-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Organized the fan meetup in Chicago" maxLength={300} className="min-h-20" required />
        </Field>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="accent" loading={pending} disabled={!valid}>
            Apply adjustment
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/* ───────────────────────── Note ───────────────────────── */

function NoteForm({ onClose, fanId }: { onClose: () => void; fanId: string }) {
  const { pending, run } = useAction();
  const [body, setBody] = React.useState("");
  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a note</DialogTitle>
        <DialogDescription>Internal only. Fans never see notes.</DialogDescription>
      </DialogHeader>
      <form
        className="mt-4 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!body.trim()) return;
          run(
            () => addNoteAction({ fanId, body: body.trim() }),
            () => {
              toast.success("Note added");
              onClose();
            },
          );
        }}
      >
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Met at the LA show, asked about VIP packages…" maxLength={2000} autoFocus required />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending} disabled={!body.trim()}>
            Save note
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/* ───────────────────────── Verify attendance ───────────────────────── */

function VerifyForm({ onClose, fanId, events }: { onClose: () => void; fanId: string; events: FanActionsProps["events"] }) {
  const { pending, run } = useAction();
  const [eventId, setEventId] = React.useState("");
  const selectable = events.filter((e) => !e.attended);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Verify attendance</DialogTitle>
        <DialogDescription>Staff-verified check-in. Awards the event&apos;s check-in points and attendance score, no QR needed.</DialogDescription>
      </DialogHeader>
      {selectable.length === 0 ? (
        <p className="mt-4 rounded-xl bg-muted px-4 py-6 text-center text-sm text-muted-foreground">{events.length === 0 ? "No events yet. Create one under Events first." : "This fan is already checked in to every event."}</p>
      ) : (
        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!eventId) return;
            run(
              () => verifyAttendanceAction({ fanId, eventId }),
              (d) => {
                toast.success(`Checked in to ${d.eventName}`);
                onClose();
              },
            );
          }}
        >
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {selectable.map((ev) => (
              <li key={ev.id}>
                <label className={cn("flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted", eventId === ev.id && "bg-accent-soft")}>
                  <input type="radio" name="event" value={ev.id} checked={eventId === ev.id} onChange={() => setEventId(ev.id)} className="accent-[var(--accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{ev.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(ev.startsAt, { month: "short", day: "numeric", year: "numeric" })}
                      {ev.city ? ` · ${ev.city}` : ""}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="accent" loading={pending} disabled={!eventId}>
              Verify attendance
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}

/* ───────────────────────── Tags ───────────────────────── */

function TagsForm({ onClose, fanId, allTags, assignedTagIds }: { onClose: () => void; fanId: string; allTags: FanActionsProps["allTags"]; assignedTagIds: string[] }) {
  const router = useRouter();
  const [assigned, setAssigned] = React.useState<Set<string>>(() => new Set(assignedTagIds));
  // Tags created inside the dialog show up immediately, before the page refreshes.
  const [localTags, setLocalTags] = React.useState<FanActionsProps["allTags"]>([]);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const tags = React.useMemo(() => [...allTags, ...localTags.filter((t) => !allTags.some((a) => a.id === t.id))], [allTags, localTags]);

  const toggle = async (tagId: string) => {
    const on = !assigned.has(tagId);
    setBusy(tagId);
    const res = await toggleTagAction({ fanId, tagId, on });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAssigned((prev) => {
      const next = new Set(prev);
      if (on) next.add(tagId);
      else next.delete(tagId);
      return next;
    });
    router.refresh();
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const res = await createTagAction({ name });
    if (!res.ok) {
      setCreating(false);
      toast.error(res.error);
      return;
    }
    const tag = res.data;
    if (!tag) {
      setCreating(false);
      toast.info("A tag with that name already exists");
      return;
    }
    const on = await toggleTagAction({ fanId, tagId: tag.id, on: true });
    setCreating(false);
    if (!on.ok) {
      toast.error(on.error);
      return;
    }
    setNewName("");
    setLocalTags((prev) => [...prev, { id: tag.id, name: tag.name, color: tag.color }]);
    setAssigned((prev) => new Set(prev).add(tag.id));
    toast.success(`Tagged as ${name}`);
    router.refresh();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Tags</DialogTitle>
        <DialogDescription>Toggle tags for this fan, or create a new one.</DialogDescription>
      </DialogHeader>
      <div className="mt-4 flex flex-col gap-4">
        {tags.length === 0 ? (
          <p className="rounded-xl bg-muted px-4 py-5 text-center text-sm text-muted-foreground">No tags yet. Create your first one below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => {
              const on = assigned.has(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => toggle(t.id)}
                  className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-60", on ? "border-transparent text-foreground" : "border-border-strong text-muted-foreground hover:bg-muted")}
                  style={on ? { background: `color-mix(in oklab, ${t.color} 22%, transparent)` } : undefined}
                  aria-pressed={on}
                >
                  <span className="size-2 rounded-full" style={{ background: t.color }} />
                  {t.name}
                  {on ? <Check className="size-3" /> : null}
                </button>
              );
            })}
          </div>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New tag name" maxLength={40} />
          <Button type="submit" variant="secondary" loading={creating} disabled={!newName.trim()}>
            <Plus /> Create
          </Button>
        </form>
      </div>
      <DialogFooter>
        <Button type="button" onClick={onClose}>
          Done
        </Button>
      </DialogFooter>
    </>
  );
}
