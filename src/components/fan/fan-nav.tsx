"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Gift, Home, ListChecks, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bottom tab bar for the passport (mobile-first), horizontal tabs on desktop. */
export function FanNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/fan/${slug}`;
  const items = [
    { href: base, label: "Passport", icon: Home, exact: true },
    { href: `${base}/challenges`, label: "Challenges", icon: ListChecks },
    { href: `${base}/rewards`, label: "Rewards", icon: Gift },
    { href: `${base}/badges`, label: "Badges", icon: Award },
    { href: `${base}/activity`, label: "Activity", icon: Sparkles },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] glass sm:sticky sm:top-0 sm:border-b sm:border-t-0">
      <div className="mx-auto flex max-w-lg items-stretch justify-around sm:max-w-2xl">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors sm:flex-row sm:gap-1.5 sm:py-3 sm:text-xs",
                active ? "text-artist" : "text-subtle hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5 sm:size-4", active && "fill-current/10")} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
