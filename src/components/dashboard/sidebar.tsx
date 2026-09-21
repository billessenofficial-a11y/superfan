"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, CalendarDays, Gift, LayoutDashboard, Megaphone, Plug, Settings, SlidersHorizontal, Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/fans", label: "Fans", icon: Users },
  { href: "/app/segments", label: "Segments", icon: SlidersHorizontal },
  { href: "/app/activity", label: "Activity", icon: Activity },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/app/challenges", label: "Challenges", icon: Target },
  { href: "/app/rewards", label: "Rewards", icon: Gift },
  { href: "/app/events", label: "Events", icon: CalendarDays },
  { href: "/app/integrations", label: "Integrations", icon: Plug },
  { href: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors",
              active ? "bg-foreground/[0.07] text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4", active ? "text-accent" : "text-subtle group-hover:text-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
