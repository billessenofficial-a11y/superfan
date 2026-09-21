"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarRange, Gift, MapPin, MoreHorizontal, Pause, Pencil, Play, Plus, Shield, Sparkles, Square, Undo2, Check } from "lucide-react";
import type { fanLevels, rewards } from "@/db/schema";
import { cancelRedemptionAction, fulfillRedemptionAction, setRewardStatusAction } from "@/lib/actions/rewards";
import { cn, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/shared/action-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fanName } from "./form-utils";
import { FULFILLMENT_TYPES, RewardDialog } from "./reward-dialog";
import { StatusBadge } from "./status-badge";
import { useRunAction } from "./use-run-action";

export type RewardRow = typeof rewards.$inferSelect;
export type LevelRow = typeof fanLevels.$inferSelect;
export type RedemptionRow = {
  id: string;
  rewardId: string;
  rewardName: string;
  pointsSpent: number;
  status: "pending" | "fulfilled" | "cancelled";
  redeemedAt: Date;
  fulfilledAt: Date | null;
  fulfillmentNote: string | null;
  fanId: string;
  fanFirstName: string | null;
  fanLastName: string | null;
  fanEmail: string | null;
  fanAvatarUrl: string | null;
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

export function RewardsView({ rewards, levels, redemptions, canManage }: { rewards: RewardRow[]; levels: LevelRow[]; redemptions: RedemptionRow[]; canManage: boolean }) {
  const [filter, setFilter] = React.useState<Filter>("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<RewardRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (reward: RewardRow) => {
    setEditing(reward);
    setDialogOpen(true);
  };

  const visible = filter === "all" ? rewards : rewards.filter((r) => r.status === filter);
  const pendingCount = redemptions.filter((r) => r.status === "pending").length;
  const levelById = new Map(levels.map((l) => [l.id, l]));

  return (
    <div>
      <PageHeader
        title="Rewards"
        description="What your fans can redeem their points for."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus /> Create reward
            </Button>
          ) : null
        }
      />

      <Tabs defaultValue="rewards">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="rewards">Rewards</TabsTrigger>
            <TabsTrigger value="redemptions">
              Redemptions
              {pendingCount > 0 ? <span className="rounded-full bg-warning-soft px-1.5 text-[10px] font-semibold text-warning tabular">{pendingCount}</span> : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="rewards">
          {rewards.length === 0 ? (
            <EmptyState
              icon={<Gift />}
              title="Give your superfans something worth earning."
              description="Create early access, exclusive drops, experiences and more."
              actions={
                canManage ? (
                  <Button onClick={openCreate}>
                    <Plus /> Create Reward
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => {
                  const count = f.value === "all" ? rewards.length : rewards.filter((r) => r.status === f.value).length;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFilter(f.value)}
                      className={cn(
                        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
                        filter === f.value ? "border-transparent bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {f.label}
                      <span className={cn("tabular", filter === f.value ? "opacity-70" : "text-subtle")}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {visible.length === 0 ? (
                <EmptyState compact title={`No ${filter} rewards`} description="Try another filter." />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {visible.map((r) => (
                    <RewardCard key={r.id} reward={r} level={r.minimumLevelId ? levelById.get(r.minimumLevelId) : undefined} canManage={canManage} onEdit={() => openEdit(r)} />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="redemptions">
          <RedemptionsList redemptions={redemptions} canManage={canManage} />
        </TabsContent>
      </Tabs>

      <RewardDialog open={dialogOpen} onOpenChange={setDialogOpen} reward={editing} levels={levels} />
    </div>
  );
}

function RewardCard({ reward, level, canManage, onEdit }: { reward: RewardRow; level?: LevelRow; canManage: boolean; onEdit: () => void }) {
  const { pending, run } = useRunAction();
  const setStatus = (status: "active" | "paused" | "ended") => run(() => setRewardStatusAction({ id: reward.id, status }), { success: `Reward ${status === "active" ? "activated" : status}` });
  const fulfillment = FULFILLMENT_TYPES.find((f) => f.value === reward.fulfillmentType)?.label ?? reward.fulfillmentType;
  const remaining = reward.inventory == null ? null : Math.max(0, reward.inventory - reward.redeemedCount);
  const soldOut = remaining === 0;

  return (
    <Card className={cn("flex flex-col overflow-hidden animate-rise", pending && "opacity-60")}>
      {reward.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={reward.imageUrl} alt="" className="h-36 w-full object-cover" loading="lazy" />
      ) : null}
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold tracking-tight">{reward.name}</h3>
            {reward.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{reward.description}</p> : null}
          </div>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Reward actions" className="-mr-2 -mt-1 shrink-0">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {reward.status !== "active" ? (
                  <DropdownMenuItem onSelect={() => setStatus("active")}>
                    <Play /> Activate
                  </DropdownMenuItem>
                ) : null}
                {reward.status === "active" ? (
                  <DropdownMenuItem onSelect={() => setStatus("paused")}>
                    <Pause /> Pause
                  </DropdownMenuItem>
                ) : null}
                {reward.status !== "ended" ? (
                  <DropdownMenuItem onSelect={() => setStatus("ended")} destructive>
                    <Square /> End
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1">
            <span className="tabular text-3xl font-semibold tracking-tight">{formatNumber(reward.pointCost)}</span>
            <span className="text-xs font-medium text-muted-foreground">pts</span>
          </div>
          <span className={cn("tabular text-xs", soldOut ? "font-medium text-danger" : "text-muted-foreground")}>
            {reward.inventory == null ? "Unlimited" : soldOut ? "Sold out" : `${formatNumber(remaining)} / ${formatNumber(reward.inventory)} left`}
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <StatusBadge status={reward.status} />
          <Badge variant="outline">{fulfillment}</Badge>
          {level ? (
            <Badge variant="accent">
              <Shield /> {level.name}+
            </Badge>
          ) : null}
          {reward.minimumScore != null ? (
            <Badge variant="accent">
              <Sparkles /> Score {formatNumber(reward.minimumScore)}+
            </Badge>
          ) : null}
          {reward.locationRestriction ? (
            <Badge variant="outline">
              <MapPin /> {reward.locationRestriction}
            </Badge>
          ) : null}
        </div>

        <div className="mt-auto flex items-center justify-between text-[11px] text-subtle">
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="size-3" />
            {reward.startsAt || reward.endsAt ? `${reward.startsAt ? formatDate(reward.startsAt) : "Now"} → ${reward.endsAt ? formatDate(reward.endsAt) : "no end"}` : "Always available"}
          </span>
          <span className="tabular">{formatNumber(reward.redeemedCount)} redeemed</span>
        </div>
      </div>
    </Card>
  );
}

function RedemptionsList({ redemptions, canManage }: { redemptions: RedemptionRow[]; canManage: boolean }) {
  if (redemptions.length === 0) {
    return <EmptyState compact icon={<Gift />} title="No redemptions yet" description="When fans redeem rewards, they show up here for fulfilment." />;
  }
  return (
    <>
      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {redemptions.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex items-center gap-3">
              <Avatar src={r.fanAvatarUrl} name={fanName({ firstName: r.fanFirstName, lastName: r.fanLastName, email: r.fanEmail })} size={32} />
              <div className="min-w-0 flex-1">
                <Link href={`/app/fans/${r.fanId}`} className="block truncate text-sm font-medium hover:underline">
                  {fanName({ firstName: r.fanFirstName, lastName: r.fanLastName, email: r.fanEmail })}
                </Link>
                <p className="truncate text-xs text-muted-foreground">{r.rewardName}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular">{formatNumber(r.pointsSpent)} pts</span>
              <span>{formatDateTime(r.redeemedAt)}</span>
            </div>
            {canManage && r.status === "pending" ? (
              <div className="mt-3 flex gap-2">
                <RedemptionActions redemption={r} />
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      {/* Desktop: table */}
      <Card className="hidden overflow-hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fan</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Redeemed</TableHead>
              {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {redemptions.map((r) => {
              const name = fanName({ firstName: r.fanFirstName, lastName: r.fanLastName, email: r.fanEmail });
              return (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/app/fans/${r.fanId}`} className="flex items-center gap-2.5 hover:underline">
                      <Avatar src={r.fanAvatarUrl} name={name} size={28} />
                      <span className="font-medium">{name}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate">{r.rewardName}</TableCell>
                  <TableCell className="text-right tabular">{formatNumber(r.pointsSpent)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(r.redeemedAt)}</TableCell>
                  {canManage ? (
                    <TableCell className="text-right">
                      {r.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <RedemptionActions redemption={r} />
                        </div>
                      ) : r.status === "fulfilled" && r.fulfilledAt ? (
                        <span className="text-xs text-subtle">{formatDate(r.fulfilledAt)}</span>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}

function RedemptionActions({ redemption }: { redemption: RedemptionRow }) {
  const { pending, run } = useRunAction();
  const cancel = () => {
    const reason = window.prompt("Why are you cancelling? The fan will be refunded their points.");
    if (reason == null) return;
    if (reason.trim().length < 3) {
      window.alert("Please give a short reason (at least 3 characters).");
      return;
    }
    run(() => cancelRedemptionAction({ redemptionId: redemption.id, reason: reason.trim() }), { success: "Redemption cancelled and points refunded" });
  };
  return (
    <>
      <ActionButton size="sm" variant="secondary" action={() => fulfillRedemptionAction({ redemptionId: redemption.id })} successMessage="Marked as fulfilled">
        <Check className="size-3.5" /> Fulfill
      </ActionButton>
      <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={cancel} loading={pending}>
        <Undo2 className="size-3.5" /> Cancel &amp; refund
      </Button>
    </>
  );
}
