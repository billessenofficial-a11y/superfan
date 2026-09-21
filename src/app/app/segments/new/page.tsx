import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireArtistContext } from "@/lib/auth/context";
import { getSegmentBuilderData } from "@/lib/dashboard/segment-builder-data";
import { PageHeader } from "@/components/dashboard/page-header";
import { SegmentBuilder } from "@/components/segments/segment-builder";

export const metadata = { title: "New segment · Superfan" };

export default async function NewSegmentPage() {
  const ctx = await requireArtistContext("manageSegments");
  const { options, totalFans } = await getSegmentBuilderData(ctx.artist.id);
  return (
    <div className="animate-fade-in">
      <Link href="/app/segments" className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-3.5" /> Segments
      </Link>
      <PageHeader eyebrow="Segments" title="New segment" description="Combine conditions to define an audience. The count updates as you build." />
      <SegmentBuilder options={options} totalFans={totalFans} />
    </div>
  );
}
