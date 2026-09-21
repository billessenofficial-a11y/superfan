import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { Instagram, SearchX, Upload, Users } from "lucide-react";
import { db } from "@/db";
import { fanLevels, fanTags, segments } from "@/db/schema";
import { can, requireArtistContext } from "@/lib/auth/context";
import { listFans, topCities } from "@/lib/fans/queries";
import { formatNumber, isUuid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/dashboard/page-header";
import { FanFilters } from "@/components/fans/fan-filters";
import { FanTable } from "@/components/fans/fan-table";
import { ExportFansButton } from "@/components/fans/export-button";
import { activeFilterCount, parseFanParams, toListFilters, type SearchParamsRecord } from "@/components/fans/fan-filter-params";

export const metadata = { title: "Fans · Superfan" };

export default async function FansPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const ctx = await requireArtistContext();
  const artistId = ctx.artist.id;
  const state = parseFanParams(await searchParams);

  const [levels, cities, tags, segment] = await Promise.all([
    db.select({ id: fanLevels.id, name: fanLevels.name, color: fanLevels.color }).from(fanLevels).where(eq(fanLevels.artistId, artistId)).orderBy(fanLevels.sortOrder),
    topCities(artistId, 12),
    db.select({ id: fanTags.id, name: fanTags.name, color: fanTags.color }).from(fanTags).where(eq(fanTags.artistId, artistId)).orderBy(fanTags.name),
    isUuid(state.segment)
      ? db
          .select({ id: segments.id, name: segments.name, rules: segments.rules })
          .from(segments)
          .where(and(eq(segments.id, state.segment), eq(segments.artistId, artistId)))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);

  const filters = { ...toListFilters(state), rules: segment?.rules ?? null };
  const result = await listFans(artistId, filters);
  const filtered = activeFilterCount(state) > 0 || Boolean(segment);
  const canExport = can(ctx.role, "exportFans");

  // No fans at all for this artist → onboarding empty state.
  if (result.total === 0 && !filtered) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Fans" description="Your identified fans, scored and ranked." />
        <EmptyState
          icon={<Users />}
          title="No fans yet."
          description="Connect an integration or import your existing fan list to get started."
          actions={
            <>
              <Button asChild variant="accent">
                <Link href="/app/integrations">
                  <Instagram /> Connect Instagram
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/app/settings?tab=import">
                  <Upload /> Import CSV
                </Link>
              </Button>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Fans"
        description={
          <>
            <span className="tabular">{formatNumber(result.total)}</span> {filtered ? "matching fans" : "identified fans"}
          </>
        }
        actions={canExport ? <ExportFansButton filters={filters} fileName={`${ctx.artist.slug}-fans.csv`} /> : null}
      />

      <FanFilters state={state} levels={levels} cities={cities} tags={tags} segment={segment ? { id: segment.id, name: segment.name } : null} />

      {result.rows.length === 0 ? (
        <EmptyState
          compact
          icon={<SearchX />}
          title="No fans match these filters."
          description="Try widening the score range, clearing the search, or removing the segment."
          actions={
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/fans">Clear all filters</Link>
            </Button>
          }
        />
      ) : (
        <FanTable rows={result.rows} state={state} total={result.total} page={result.page} pages={result.pages} pageSize={result.pageSize} />
      )}
    </div>
  );
}
