import Link from "next/link";
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export type AuditRow = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  actorLabel: string | null;
  createdAt: Date;
  actorEmail: string | null;
  actorName: string | null;
  actorAvatarUrl: string | null;
};

const TARGET_HREF: Record<string, (id: string) => string> = {
  fan: (id) => `/app/fans/${id}`,
  event: (id) => `/app/events/${id}`,
  reward: () => "/app/rewards",
  challenge: () => "/app/challenges",
  campaign: () => "/app/campaigns",
  segment: () => "/app/segments",
  integration: () => "/app/integrations",
};

/** "reward.created" → "Reward created" */
function humanize(action: string): string {
  const [entity, verb] = action.split(".");
  const words = [entity, verb].filter(Boolean).map((w) => w.replace(/_/g, " "));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function compactMetadata(meta: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v == null || v === "") continue;
    const value = typeof v === "object" ? JSON.stringify(v) : String(v);
    parts.push(`${k}: ${value.length > 48 ? `${value.slice(0, 47)}…` : value}`);
    if (parts.length >= 4) break;
  }
  return parts.join(" · ");
}

export function AuditLog({ rows, page, pageSize, total }: { rows: AuditRow[]; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) {
    return <EmptyState icon={<ScrollText />} title="Nothing logged yet" description="Team actions like editing rewards, adjusting points and connecting integrations are recorded here." />;
  }
  return (
    <div className="flex flex-col gap-4">
      <Card className="divide-y divide-border">
        {rows.map((r) => {
          const actor = r.actorName ?? r.actorEmail ?? r.actorLabel ?? "System";
          const meta = compactMetadata(r.metadata);
          const href = r.targetType && r.targetId ? TARGET_HREF[r.targetType]?.(r.targetId) : undefined;
          return (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3">
              <Avatar src={r.actorAvatarUrl} name={actor} size={28} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium">{actor}</span>
                  <span className="text-muted-foreground">{humanize(r.action)}</span>
                  {r.targetType ? (
                    href ? (
                      <Link href={href} className="inline-flex">
                        <Badge variant="outline" className="capitalize hover:bg-muted">
                          {r.targetType}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge variant="outline" className="capitalize">
                        {r.targetType}
                      </Badge>
                    )
                  ) : null}
                </p>
                {meta ? <p className="mt-0.5 truncate font-mono text-[11px] text-subtle">{meta}</p> : null}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground" dateTime={r.createdAt.toISOString()}>
                {formatDateTime(r.createdAt)}
              </time>
            </div>
          );
        })}
      </Card>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular">
          Page {page} of {pages} · {formatNumber(total)} entries
        </span>
        <div className="flex gap-1">
          <PageLink page={page - 1} disabled={page <= 1} label="Previous">
            <ChevronLeft className="size-4" />
          </PageLink>
          <PageLink page={page + 1} disabled={page >= pages} label="Next">
            <ChevronRight className="size-4" />
          </PageLink>
        </div>
      </div>
    </div>
  );
}

function PageLink({ page, disabled, label, children }: { page: number; disabled: boolean; label: string; children: React.ReactNode }) {
  const cls = "inline-flex size-8 items-center justify-center rounded-full border border-border transition-colors";
  if (disabled) return <span className={`${cls} opacity-40`} aria-disabled>{children}</span>;
  return (
    <Link href={`/app/settings?tab=audit&page=${page}`} className={`${cls} hover:bg-muted`} aria-label={label}>
      {children}
    </Link>
  );
}
