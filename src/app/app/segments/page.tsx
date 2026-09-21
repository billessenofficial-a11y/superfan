import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Plus, SlidersHorizontal, Users } from "lucide-react";
import { db } from "@/db";
import { artistEvents, fanLevels, fanTags, segments, type SegmentGroup, type SegmentNode } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { describeCondition } from "@/lib/segments/query";
import { formatNumber, formatRelative } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeleteSegmentButton, RefreshCountButton } from "@/components/segments/segment-card-actions";

export const metadata = { title: "Segments · Superfan" };

type Lookups = { levels: Map<string, string>; tags: Map<string, string>; events: Map<string, string> };

function countConditions(node: SegmentNode): number {
  if (node.kind === "condition") return 1;
  return node.children.reduce((s, c) => s + countConditions(c), 0);
}

/** Flat, human-readable summary of a rule tree, e.g. "City = LA and Score ≥ 3,500 (and 2 more)". */
function summarize(group: SegmentGroup, lookups: Lookups, max = 3): string {
  const parts: string[] = [];
  const walk = (node: SegmentNode) => {
    if (parts.length >= max) return;
    if (node.kind === "condition") parts.push(describeCondition(node, lookups));
    else node.children.forEach(walk);
  };
  walk(group);
  const total = countConditions(group);
  if (total === 0) return "All fans";
  const joiner = group.match === "all" ? " and " : " or ";
  return parts.join(joiner) + (total > max ? ` (and ${total - max} more)` : "");
}

export default async function SegmentsPage() {
  const ctx = await requireArtistContext();
  const artistId = ctx.artist.id;
  const canManage = can(ctx.role, "manageSegments");

  const [rows, levels, tags, events] = await Promise.all([
    db.select().from(segments).where(eq(segments.artistId, artistId)).orderBy(desc(segments.updatedAt)),
    db.select({ id: fanLevels.id, name: fanLevels.name }).from(fanLevels).where(eq(fanLevels.artistId, artistId)),
    db.select({ id: fanTags.id, name: fanTags.name }).from(fanTags).where(eq(fanTags.artistId, artistId)),
    db.select({ id: artistEvents.id, name: artistEvents.name }).from(artistEvents).where(eq(artistEvents.artistId, artistId)),
  ]);
  const lookups: Lookups = {
    levels: new Map(levels.map((l) => [l.id, l.name])),
    tags: new Map(tags.map((t) => [t.id, t.name])),
    events: new Map(events.map((e) => [e.id, e.name])),
  };

  const newButton = canManage ? (
    <Button asChild variant="accent">
      <Link href="/app/segments/new">
        <Plus /> New segment
      </Link>
    </Button>
  ) : null;

  if (rows.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Segments" description="Saved audiences built from fan data." actions={newButton} />
        <EmptyState
          icon={<SlidersHorizontal />}
          title="No segments yet."
          description="Build your first segment to target fans by score, city, spend, attendance and more. Segments power campaigns and exports."
          actions={
            canManage ? (
              <Button asChild variant="accent">
                <Link href="/app/segments/new">
                  <Plus /> Create your first segment
                </Link>
              </Button>
            ) : null
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader title="Segments" description={`${formatNumber(rows.length)} saved ${rows.length === 1 ? "audience" : "audiences"}. Counts refresh when you save or on demand.`} actions={newButton} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((s) => (
          <Card key={s.id} className="flex flex-col transition-shadow hover:shadow-lg">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {canManage ? (
                    <Link href={`/app/segments/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  ) : (
                    s.name
                  )}
                </CardTitle>
                {s.description ? <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{s.description}</p> : null}
              </div>
              <RefreshCountButton id={s.id} />
            </CardHeader>
            <CardContent className="flex-1 pt-4">
              <div className="flex items-baseline gap-2">
                <span className="tabular text-3xl font-semibold tracking-tight">{s.cachedCount == null ? "—" : formatNumber(s.cachedCount)}</span>
                <span className="text-sm text-muted-foreground">fans</span>
                {s.cachedAt ? <span className="ml-auto text-[11px] text-subtle">counted {formatRelative(s.cachedAt)}</span> : null}
              </div>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-muted-foreground">
                <span className="mr-1 rounded-md bg-muted px-1.5 py-0.5 font-medium uppercase tracking-wide text-subtle">{s.rules.match === "all" ? "All" : "Any"}</span>
                {summarize(s.rules, lookups)}
              </p>
            </CardContent>
            <CardFooter className="justify-between gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href={`/app/fans?segment=${s.id}`}>
                  <Users /> View fans
                </Link>
              </Button>
              {canManage ? <DeleteSegmentButton id={s.id} name={s.name} /> : null}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
