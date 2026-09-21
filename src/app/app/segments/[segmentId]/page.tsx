import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ChevronLeft, Users } from "lucide-react";
import { db } from "@/db";
import { segments } from "@/db/schema";
import { requireArtistContext } from "@/lib/auth/context";
import { getSegmentBuilderData } from "@/lib/dashboard/segment-builder-data";
import { isUuid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { SegmentBuilder } from "@/components/segments/segment-builder";

export const metadata = { title: "Edit segment · Superfan" };

export default async function EditSegmentPage({ params }: { params: Promise<{ segmentId: string }> }) {
  const { segmentId } = await params;
  const ctx = await requireArtistContext("manageSegments");
  if (!isUuid(segmentId)) notFound();

  const [segment] = await db
    .select({ id: segments.id, name: segments.name, description: segments.description, rules: segments.rules, cachedCount: segments.cachedCount })
    .from(segments)
    .where(and(eq(segments.id, segmentId), eq(segments.artistId, ctx.artist.id)))
    .limit(1);
  if (!segment) notFound();

  const { options, totalFans } = await getSegmentBuilderData(ctx.artist.id);
  return (
    <div className="animate-fade-in">
      <Link href="/app/segments" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> Segments
      </Link>
      <PageHeader
        eyebrow="Segments"
        title={segment.name}
        description="Edit the rules; the count updates as you build."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/app/fans?segment=${segment.id}`}>
              <Users /> View fans
            </Link>
          </Button>
        }
      />
      <SegmentBuilder segment={segment} options={options} totalFans={totalFans} />
    </div>
  );
}
