"use client";

import * as React from "react";
import { saveRewardAction } from "@/lib/actions/rewards";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fromLocalInput, fromSelect, intOr, intOrNull, NONE, toLocalInput, toSelect } from "./form-utils";
import { useRunAction } from "./use-run-action";
import type { LevelRow, RewardRow } from "./rewards-view";

export const FULFILLMENT_TYPES = [
  { value: "digital", label: "Digital", hint: "Download, code or link delivered in-app." },
  { value: "physical", label: "Physical", hint: "Shipped merch or collectibles." },
  { value: "access", label: "Access", hint: "Early access, presales, private events." },
  { value: "lottery", label: "Lottery", hint: "Entry into a draw." },
  { value: "manual", label: "Manual", hint: "Your team fulfils it by hand." },
] as const;

type Fulfillment = (typeof FULFILLMENT_TYPES)[number]["value"];
type Status = "draft" | "active" | "paused" | "ended" | "archived";

const STATUSES: { value: Status; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

type FormState = {
  name: string;
  description: string;
  imageUrl: string;
  pointCost: string;
  inventory: string;
  startsAt: string;
  endsAt: string;
  minimumLevelId: string;
  minimumScore: string;
  locationRestriction: string;
  fulfillmentType: Fulfillment;
  status: Status;
  maxPerFan: string;
};

function initialState(reward: RewardRow | null): FormState {
  return {
    name: reward?.name ?? "",
    description: reward?.description ?? "",
    imageUrl: reward?.imageUrl ?? "",
    pointCost: reward ? String(reward.pointCost) : "500",
    inventory: reward?.inventory != null ? String(reward.inventory) : "",
    startsAt: toLocalInput(reward?.startsAt),
    endsAt: toLocalInput(reward?.endsAt),
    minimumLevelId: toSelect(reward?.minimumLevelId),
    minimumScore: reward?.minimumScore != null ? String(reward.minimumScore) : "",
    locationRestriction: reward?.locationRestriction ?? "",
    fulfillmentType: reward?.fulfillmentType ?? "digital",
    status: reward?.status ?? "draft",
    maxPerFan: reward ? String(reward.maxPerFan) : "1",
  };
}

export function RewardDialog({ open, onOpenChange, reward, levels }: { open: boolean; onOpenChange: (open: boolean) => void; reward: RewardRow | null; levels: LevelRow[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open ? <RewardForm key={reward?.id ?? "new"} reward={reward} levels={levels} onDone={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function RewardForm({ reward, levels, onDone }: { reward: RewardRow | null; levels: LevelRow[]; onDone: () => void }) {
  const [form, setForm] = React.useState<FormState>(() => initialState(reward));
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const { pending, run } = useRunAction();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    run(
      () =>
        saveRewardAction({
          id: reward?.id,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          imageUrl: form.imageUrl.trim(),
          pointCost: intOr(form.pointCost, 0),
          inventory: intOrNull(form.inventory),
          startsAt: fromLocalInput(form.startsAt),
          endsAt: fromLocalInput(form.endsAt),
          minimumLevelId: fromSelect(form.minimumLevelId),
          minimumScore: intOrNull(form.minimumScore),
          locationRestriction: form.locationRestriction.trim() || undefined,
          fulfillmentType: form.fulfillmentType,
          status: form.status,
          maxPerFan: intOr(form.maxPerFan, 1),
        }),
      {
        success: reward ? "Reward updated" : "Reward created",
        onSuccess: onDone,
        onError: (_error, fieldErrors) => setErrors(fieldErrors ?? {}),
      },
    );
  };

  const fulfillment = FULFILLMENT_TYPES.find((f) => f.value === form.fulfillmentType);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{reward ? "Edit reward" : "Create reward"}</DialogTitle>
        <DialogDescription>Fans spend Reward Points to redeem this. Points are refunded automatically if you cancel a redemption.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="reward-name" error={errors.name} className="sm:col-span-2">
          <Input id="reward-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Signed Iceman vinyl" required autoFocus maxLength={120} />
        </Field>
        <Field label="Description" htmlFor="reward-description" error={errors.description} className="sm:col-span-2">
          <Textarea id="reward-description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What fans get and how it is delivered." maxLength={1000} className="min-h-20" />
        </Field>
        <Field label="Image URL" htmlFor="reward-image" error={errors.imageUrl} className="sm:col-span-2">
          <Input id="reward-image" type="url" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} placeholder="https://…" />
        </Field>

        <Field label="Point cost" htmlFor="reward-points" error={errors.pointCost}>
          <Input id="reward-points" type="number" min={0} max={1_000_000} inputMode="numeric" value={form.pointCost} onChange={(e) => set("pointCost", e.target.value)} required className="tabular" />
        </Field>
        <Field label="Inventory" htmlFor="reward-inventory" error={errors.inventory} hint="Leave blank for unlimited.">
          <Input id="reward-inventory" type="number" min={0} inputMode="numeric" value={form.inventory} onChange={(e) => set("inventory", e.target.value)} placeholder="Unlimited" className="tabular" />
        </Field>

        <Field label="Starts" htmlFor="reward-starts" error={errors.startsAt}>
          <Input id="reward-starts" type="datetime-local" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </Field>
        <Field label="Ends" htmlFor="reward-ends" error={errors.endsAt}>
          <Input id="reward-ends" type="datetime-local" value={form.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
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
        <Field label="Minimum score" htmlFor="reward-min-score" error={errors.minimumScore}>
          <Input id="reward-min-score" type="number" min={0} inputMode="numeric" value={form.minimumScore} onChange={(e) => set("minimumScore", e.target.value)} placeholder="No minimum" className="tabular" />
        </Field>

        <Field label="Location restriction" htmlFor="reward-location" error={errors.locationRestriction} hint="City or country; matches the fan's profile.">
          <Input id="reward-location" value={form.locationRestriction} onChange={(e) => set("locationRestriction", e.target.value)} placeholder="Anywhere" maxLength={80} />
        </Field>
        <Field label="Max per fan" htmlFor="reward-max" error={errors.maxPerFan}>
          <Input id="reward-max" type="number" min={1} max={100} inputMode="numeric" value={form.maxPerFan} onChange={(e) => set("maxPerFan", e.target.value)} className="tabular" />
        </Field>

        <Field label="Fulfillment" error={errors.fulfillmentType} hint={fulfillment?.hint}>
          <Select value={form.fulfillmentType} onValueChange={(v) => set("fulfillmentType", v as Fulfillment)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FULFILLMENT_TYPES.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
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
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <DialogFooter className="mt-0">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {reward ? "Save changes" : "Create reward"}
        </Button>
      </DialogFooter>
    </form>
  );
}
