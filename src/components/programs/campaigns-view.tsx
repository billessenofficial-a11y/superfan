"use client";

import * as React from "react";
import { CalendarRange, Link2, Megaphone, MoreHorizontal, Pencil, Play, Plus, Shield, Sparkles, Square, Trash2, Users, Clock } from "lucide-react";
import type { campaigns } from "@/db/schema";
import { deleteCampaignAction, setCampaignStatusAction } from "@/lib/actions/campaigns";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { PageHeader, SectionTitle } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { CAMPAIGN_TYPES, CampaignDialog } from "./campaign-dialog";
import { StatusBadge } from "./status-badge";
import { useRunAction } from "./use-run-action";

export type CampaignRow = typeof campaigns.$inferSelect;
export type SegmentOption = { id: string; name: string; cachedCount: number | null };
export type LevelOption = { id: string; name: string; minScore: number; color: string };
export type LinkedOption = { id: string; label: string; status: string };
export type LinkedOptions = { challenges: LinkedOption[]; rewards: LinkedOption[]; events: LinkedOption[] };

type Status = CampaignRow["status"];
const GROUPS: { status: Status; label: string; description: string }[] = [
  { status: "live", label: "Live", description: "Running now" },
  { status: "scheduled", label: "Scheduled", description: "Starting soon" },
  { status: "draft", label: "Draft", description: "Not visible to fans" },
  { status: "ended", label: "Ended", description: "Finished" },
];

export function CampaignsView({ campaigns, segments, levels, linked, canManage }: { campaigns: CampaignRow[]; segments: SegmentOption[]; levels: LevelOption[]; linked: LinkedOptions; canManage: boolean }) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CampaignRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const segmentById = new Map(segments.map((s) => [s.id, s]));
  const levelById = new Map(levels.map((l) => [l.id, l]));
  const linkedById = new Map<string, LinkedOption>([...linked.challenges, ...linked.rewards, ...linked.events].map((o) => [o.id, o]));
  const live = campaigns.filter((c) => c.status === "live").length;

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description={campaigns.length ? `${formatNumber(live)} live · ${formatNumber(campaigns.length)} total` : "Fan experiences targeted at the right audience."}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus /> Create campaign
            </Button>
          ) : null
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Megaphone />}
          title="Reach the fans who matter most."
          description="Drop rewards, presales, surveys and challenges to a saved segment — or to everyone."
          actions={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus /> Create Campaign
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {GROUPS.map((g) => {
            const items = campaigns.filter((c) => c.status === g.status);
            if (items.length === 0) return null;
            return (
              <section key={g.status}>
                <SectionTitle action={<span className="text-xs text-subtle">{g.description}</span>}>
                  <span className="inline-flex items-center gap-2">
                    {g.label}
                    <span className="tabular text-xs font-normal text-muted-foreground">{items.length}</span>
                  </span>
                </SectionTitle>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((c) => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      segment={c.segmentId ? segmentById.get(c.segmentId) : undefined}
                      level={c.minimumLevelId ? levelById.get(c.minimumLevelId) : undefined}
                      linkedTo={linkedById.get(c.challengeId ?? c.rewardId ?? c.eventId ?? "")}
                      canManage={canManage}
                      onEdit={() => {
                        setEditing(c);
                        setDialogOpen(true);
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <CampaignDialog open={dialogOpen} onOpenChange={setDialogOpen} campaign={editing} segments={segments} levels={levels} linked={linked} />
    </div>
  );
}

function CampaignCard({ campaign, segment, level, linkedTo, canManage, onEdit }: { campaign: CampaignRow; segment?: SegmentOption; level?: LevelOption; linkedTo?: LinkedOption; canManage: boolean; onEdit: () => void }) {
  const { pending, run } = useRunAction();
  const setStatus = (status: Status) => run(() => setCampaignStatusAction({ id: campaign.id, status }), { success: `Campaign ${status === "live" ? "is live" : status}` });
  const remove = () => {
    if (!window.confirm(`Delete “${campaign.name}”? This cannot be undone.`)) return;
    run(() => deleteCampaignAction({ id: campaign.id }), { success: "Campaign deleted" });
  };
  const type = CAMPAIGN_TYPES.find((t) => t.value === campaign.type)?.label ?? campaign.type;
  const code = typeof campaign.config.code === "string" ? campaign.config.code : null;
  const questionCount = Array.isArray(campaign.config.questions) ? campaign.config.questions.length : 0;
  const hasEligibility = level || campaign.minimumScore != null;

  return (
    <Card className={cn("flex flex-col animate-rise", pending && "opacity-60")}>
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="accent">{type}</Badge>
              <StatusBadge status={campaign.status} />
            </div>
            <h3 className="mt-2 truncate text-sm font-semibold tracking-tight">{campaign.name}</h3>
            {campaign.description ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{campaign.description}</p> : null}
          </div>
          {canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Campaign actions" className="-mr-2 -mt-1 shrink-0">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {campaign.status !== "live" ? (
                  <DropdownMenuItem onSelect={() => setStatus("live")}>
                    <Play /> Go live
                  </DropdownMenuItem>
                ) : null}
                {campaign.status === "draft" ? (
                  <DropdownMenuItem onSelect={() => setStatus("scheduled")}>
                    <Clock /> Schedule
                  </DropdownMenuItem>
                ) : null}
                {campaign.status === "live" || campaign.status === "scheduled" ? (
                  <DropdownMenuItem onSelect={() => setStatus("ended")}>
                    <Square /> End
                  </DropdownMenuItem>
                ) : null}
                {campaign.status === "ended" ? (
                  <DropdownMenuItem onSelect={() => setStatus("draft")}>
                    <Pencil /> Back to draft
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={remove} destructive>
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt className="inline-flex items-center gap-1.5 text-subtle">
            <Users className="size-3.5" /> Audience
          </dt>
          <dd className="truncate">
            {segment ? (
              <>
                {segment.name}
                {segment.cachedCount != null ? <span className="tabular text-muted-foreground"> · {formatNumber(segment.cachedCount)} fans</span> : null}
              </>
            ) : (
              "All fans"
            )}
          </dd>
          {hasEligibility ? (
            <>
              <dt className="inline-flex items-center gap-1.5 text-subtle">
                <Shield className="size-3.5" /> Eligibility
              </dt>
              <dd className="flex flex-wrap gap-1">
                {level ? <span>{level.name}+</span> : null}
                {level && campaign.minimumScore != null ? <span className="text-subtle">·</span> : null}
                {campaign.minimumScore != null ? <span className="tabular">Score {formatNumber(campaign.minimumScore)}+</span> : null}
              </dd>
            </>
          ) : null}
          {linkedTo ? (
            <>
              <dt className="inline-flex items-center gap-1.5 text-subtle">
                <Link2 className="size-3.5" /> Linked
              </dt>
              <dd className="truncate">{linkedTo.label}</dd>
            </>
          ) : null}
          {code ? (
            <>
              <dt className="inline-flex items-center gap-1.5 text-subtle">
                <Sparkles className="size-3.5" /> Code
              </dt>
              <dd className="font-mono">{code}</dd>
            </>
          ) : null}
          {questionCount > 0 ? (
            <>
              <dt className="inline-flex items-center gap-1.5 text-subtle">
                <Sparkles className="size-3.5" /> Survey
              </dt>
              <dd>{questionCount === 1 ? "1 question" : `${questionCount} questions`}</dd>
            </>
          ) : null}
        </dl>

        <div className="mt-auto flex items-center justify-between text-[11px] text-subtle">
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="size-3" />
            {campaign.startsAt || campaign.endsAt ? `${campaign.startsAt ? formatDate(campaign.startsAt) : "Now"} → ${campaign.endsAt ? formatDate(campaign.endsAt) : "no end"}` : "No schedule"}
          </span>
          <span className="tabular">
            {formatNumber(campaign.participantsCount)}
            {campaign.capacity != null ? ` / ${formatNumber(campaign.capacity)}` : ""} joined
          </span>
        </div>
      </div>
    </Card>
  );
}
