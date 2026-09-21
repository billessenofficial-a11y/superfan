"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Gift, Lock, Package, Sparkles, Ticket, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { redeemRewardAction } from "@/lib/actions/fan";
import { cn, formatNumber } from "@/lib/utils";

export type RewardCardData = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointCost: number;
  inventory: number | null;
  redeemedCount: number;
  fulfillmentType: "digital" | "physical" | "access" | "lottery" | "manual";
  endsAt: Date | null;
};

const FULFILLMENT: Record<RewardCardData["fulfillmentType"], { label: string; icon: React.ReactNode }> = {
  digital: { label: "Digital", icon: <Zap /> },
  physical: { label: "Shipped", icon: <Package /> },
  access: { label: "Access", icon: <Ticket /> },
  lottery: { label: "Lottery", icon: <Sparkles /> },
  manual: { label: "Fulfilled by artist", icon: <Gift /> },
};

export function RewardCard({ slug, reward, eligible, reason, balance }: { slug: string; reward: RewardCardData; eligible: boolean; reason?: string; balance: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, start] = React.useTransition();
  const left = reward.inventory != null ? Math.max(0, reward.inventory - reward.redeemedCount) : null;
  const fulfillment = FULFILLMENT[reward.fulfillmentType];

  const redeem = () =>
    start(async () => {
      const res = await redeemRewardAction({ slug, rewardId: reward.id });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(`Redeemed ${res.data.rewardName}`, {
        description: res.data.status === "fulfilled" ? "It's yours. Check your redemptions below." : "The artist's team will fulfil it soon. Watch your email.",
      });
      router.refresh();
    });

  return (
    <li className={cn("card-surface flex overflow-hidden", !eligible && "opacity-90")}>
      <div className="relative w-24 shrink-0 sm:w-32">
        {reward.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={reward.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className="artist-gradient flex size-full items-center justify-center text-white/80">
            <span className="[&>svg]:size-6">{fulfillment.icon}</span>
          </div>
        )}
        {!eligible ? (
          <span className="absolute left-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/50 text-white">
            <Lock className="size-3" />
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-tight">{reward.name}</p>
          <span className="tabular shrink-0 text-sm font-semibold text-artist">{formatNumber(reward.pointCost)} pts</span>
        </div>
        {reward.description ? <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{reward.description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">
            {fulfillment.icon}
            {fulfillment.label}
          </Badge>
          {left != null ? (
            <Badge variant={left <= 5 ? "warning" : "default"} className="tabular">
              {left === 0 ? "Sold out" : `${formatNumber(left)} left`}
            </Badge>
          ) : null}
        </div>
        <div className="mt-auto pt-3">
          {eligible ? (
            <Button size="sm" variant="artist" onClick={() => setOpen(true)}>
              Redeem
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">{reason ?? "Not available right now."}</p>
          )}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem {reward.name}?</DialogTitle>
            <DialogDescription>
              This spends <span className="tabular font-semibold text-foreground">{formatNumber(reward.pointCost)} points</span>. You&apos;ll have {formatNumber(Math.max(0, balance - reward.pointCost))} left. Redemptions can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="artist" onClick={redeem} loading={pending}>
              Confirm · {formatNumber(reward.pointCost)} pts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
