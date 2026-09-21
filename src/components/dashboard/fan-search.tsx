"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import { searchFansAction } from "@/lib/actions/search";
import { Avatar } from "@/components/ui/avatar";
import { LevelBadge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatNumber } from "@/lib/utils";

type Result = Extract<Awaited<ReturnType<typeof searchFansAction>>, { ok: true }>["data"][number];

/** ⌘K style fan search with 250ms debounce. */
export function FanSearch({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Result[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const res = await searchFansAction({ query: q });
      setLoading(false);
      setResults(res.ok ? res.data : []);
      setActive(0);
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  const go = (fanId: string) => {
    setOpen(false);
    setQ("");
    router.push(`/app/fans/${fanId}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-foreground/[0.03] px-3 text-left text-sm text-subtle transition-colors hover:bg-foreground/[0.06]">
            <Search className="size-4" />
            <span className="flex-1">Search fans…</span>
            <kbd className="rounded-md border border-border px-1.5 py-0.5 font-mono text-[10px] text-subtle">⌘K</kbd>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="top-[12%] translate-y-0 p-0" showClose={false}>
        <DialogTitle className="sr-only">Search fans</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4">
          {loading ? <Loader2 className="size-4 animate-spin text-subtle" /> : <Search className="size-4 text-subtle" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") setActive((a) => Math.min(results.length - 1, a + 1));
              if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
              if (e.key === "Enter" && results[active]) go(results[active].fanId);
            }}
            placeholder="Search by name, email, Instagram or phone"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {q.trim().length < 2 ? (
            <p className="px-3 py-6 text-center text-xs text-subtle">Type at least two characters.</p>
          ) : results.length === 0 && !loading ? (
            <p className="px-3 py-6 text-center text-xs text-subtle">No fans match &ldquo;{q}&rdquo;.</p>
          ) : (
            results.map((r, i) => (
              <button
                key={r.fanId}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.fanId)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === active ? "bg-muted" : ""}`}
              >
                <Avatar src={r.avatarUrl} name={r.name} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{r.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.email ?? ""}
                    {r.instagramUsername ? ` · @${r.instagramUsername}` : ""}
                    {r.city ? ` · ${r.city}` : ""}
                  </span>
                </span>
                <span className="tabular text-xs text-muted-foreground">{formatNumber(r.score)}</span>
                <LevelBadge name={r.levelName} color={r.levelColor} />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
