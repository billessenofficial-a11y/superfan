"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { leaveArtistAction } from "@/lib/actions/fan";
import { ActionButton } from "@/components/shared/action-button";

/**
 * Lets a fan leave an artist's fan club from their passport. History,
 * score and points are kept so rejoining later restores everything.
 */
export function LeaveArtistButton({ slug, artistName }: { slug: string; artistName: string }) {
  const router = useRouter();
  return (
    <ActionButton
      variant="ghost"
      size="sm"
      className="text-muted-foreground hover:text-danger"
      action={() => leaveArtistAction({ slug })}
      confirm={`Leave ${artistName}'s fan club? You'll stop receiving updates and rewards. Your history and points are kept, so you can rejoin any time.`}
      successMessage={`You left ${artistName}'s fan club`}
      refresh={false}
      onSuccess={() => router.push("/fan")}
    >
      <LogOut className="size-3.5" /> Leave {artistName}&apos;s fan club
    </ActionButton>
  );
}
