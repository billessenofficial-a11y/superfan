"use client";

import * as React from "react";
import { Share2, Users } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";

const noop = () => () => {};
const shareSupported = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

export function ReferralCard({ link, artistName, points, qualified, pending }: { link: string; artistName: string; points: number; qualified: number; pending: number }) {
  // Web Share is a browser capability: read it via an external-store subscription so the server render stays deterministic.
  const canShare = React.useSyncExternalStore(noop, shareSupported, () => false);

  const share = async () => {
    try {
      await navigator.share({ title: `Join ${artistName}'s fan club`, text: `I'm in ${artistName}'s fan club on Superfan. Join with my link:`, url: link });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Link copied");
      } catch {
        toast.error("Could not share the link");
      }
    }
  };

  return (
    <section className="card-surface p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-artist/10 text-artist">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold tracking-tight">Invite friends</h2>
          <p className="text-xs text-muted-foreground">
            <span className="tabular font-medium text-artist">+{formatNumber(points)} points</span> for every friend who joins and shows up.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{link.replace(/^https?:\/\//, "")}</span>
        <CopyButton value={link} size="sm" variant="secondary" className="shrink-0" />
        {canShare ? (
          <Button size="sm" variant="artist" className="shrink-0" onClick={share} aria-label="Share link">
            <Share2 className="size-3.5" />
            Share
          </Button>
        ) : null}
      </div>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>
          <span className="tabular font-semibold text-foreground">{qualified}</span> {qualified === 1 ? "friend" : "friends"} qualified
        </span>
        <span>
          <span className="tabular font-semibold text-foreground">{pending}</span> pending
        </span>
      </div>
    </section>
  );
}
