"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Instagram, MapPin, Share2, ShoppingBag, Target, Trophy } from "lucide-react";
import { generateDemoEventAction } from "@/lib/actions/demo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const KINDS = [
  { key: "instagram_comment", label: "Instagram comment", icon: Instagram },
  { key: "merch_order", label: "Merch order", icon: ShoppingBag },
  { key: "concert_checkin", label: "Concert check-in", icon: MapPin },
  { key: "referral", label: "Referral", icon: Share2 },
  { key: "challenge_completion", label: "Challenge completion", icon: Target },
  { key: "reward_redemption", label: "Reward redemption", icon: Trophy },
] as const;

/**
 * Development-only menu that pushes a synthetic event through the real
 * ingestion pipeline so the dashboard visibly reacts.
 */
export function DemoMenu({ className }: { className?: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const run = (kind: (typeof KINDS)[number]["key"]) =>
    start(async () => {
      const res = await generateDemoEventAction({ kind });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.title, { description: res.data.detail, href: res.data.href });
      router.refresh();
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-dashed border-warning/40 bg-warning-soft px-3 py-2 text-left text-[13px] font-medium text-warning transition-colors hover:bg-warning/20 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          pending && "animate-pulse-soft",
          className,
        )}
      >
        <FlaskConical className="size-4" />
        <span className="flex-1">Generate demo event</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Simulate live ingestion</DropdownMenuLabel>
        {KINDS.map((k) => (
          <DropdownMenuItem key={k.key} onSelect={() => run(k.key)} disabled={pending}>
            <k.icon /> {k.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <p className="px-2.5 py-1.5 text-[11px] leading-4 text-subtle">Development only. Events go through the same pipeline as real webhooks.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
