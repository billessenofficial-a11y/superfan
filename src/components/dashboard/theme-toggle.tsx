"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { setThemeAction } from "@/lib/actions/theme";
import type { Theme } from "@/lib/theme";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const APP_SHELL_ID = "app-shell";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Apply a theme to the dashboard shell immediately (the cookie makes it stick across loads). */
function applyTheme(theme: Theme) {
  const shell = document.getElementById(APP_SHELL_ID);
  if (!shell) return;
  shell.classList.toggle("dark", theme === "dark" || (theme === "system" && systemPrefersDark()));
  shell.dataset.theme = theme;
}

/**
 * Keeps a "system" theme in sync with the OS preference while the page is
 * open. Renders nothing.
 */
export function ThemeSync({ theme }: { theme: Theme }) {
  React.useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => applyTheme("system");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [theme]);
  return null;
}

export function ThemeToggle({ theme, className }: { theme: Theme; className?: string }) {
  const router = useRouter();
  const [current, setCurrent] = React.useState<Theme>(theme);
  const [, start] = React.useTransition();
  const Icon = OPTIONS.find((o) => o.value === current)?.icon ?? Moon;

  const choose = (next: Theme) => {
    setCurrent(next);
    applyTheme(next);
    start(async () => {
      await setThemeAction({ theme: next });
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change appearance"
        title="Appearance"
        className={cn("flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50", className)}
      >
        <Icon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((o) => (
          <DropdownMenuItem key={o.value} onSelect={() => choose(o.value)}>
            <o.icon /> {o.label}
            {o.value === current ? <Check className="ml-auto size-4 text-accent" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
