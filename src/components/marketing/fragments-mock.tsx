import { ArrowRight, CalendarDays, MessageCircle, ShoppingBag, Ticket } from "lucide-react";
import { ProviderIcon } from "@/components/shared/provider-icon";

const SOURCES = [
  { label: "Instagram", icon: <ProviderIcon provider="instagram" size={18} />, detail: "Comments, DMs, mentions" },
  { label: "Shopify", icon: <ShoppingBag className="size-[18px]" />, detail: "Orders and merch" },
  { label: "Ticketing", icon: <Ticket className="size-[18px]" />, detail: "Verified attendance" },
  { label: "Community", icon: <MessageCircle className="size-[18px]" />, detail: "Discord, fan club" },
  { label: "Events", icon: <CalendarDays className="size-[18px]" />, detail: "QR check-ins" },
];

/** "Your audience is fragmented" → Superfan → "One fan identity." */
export function FragmentsMock() {
  return (
    <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
        {SOURCES.map((s, i) => (
          <div key={s.label} className="card-surface flex items-center gap-3 px-4 py-3.5 animate-rise" style={{ animationDelay: `${i * 60}ms` }}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">{s.icon}</span>
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="truncate text-[11px] text-subtle">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 lg:flex-col">
        <ArrowRight className="size-5 text-subtle rotate-90 lg:rotate-0" />
        <span className="rounded-full bg-gradient-to-r from-violet-500 to-pink-500 px-4 py-2 text-xs font-semibold tracking-[0.2em] text-white shadow-lg shadow-violet-500/25">SUPERFAN</span>
        <ArrowRight className="size-5 text-subtle rotate-90 lg:rotate-0" />
      </div>

      <div className="artist-gradient relative overflow-hidden rounded-3xl p-6 text-white shadow-2xl shadow-violet-500/20">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">One fan identity.</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/15 text-sm font-semibold ring-2 ring-white/20">JR</span>
          <div className="leading-tight">
            <p className="text-lg font-semibold tracking-tight">James Rellera</p>
            <p className="text-xs text-white/60">Los Angeles · Icon</p>
          </div>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-white/80">
          <li>3 shows attended</li>
          <li>$284 merch</li>
          <li>18 Instagram comments</li>
          <li>4 fans referred</li>
        </ul>
        <div className="mt-5 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/50">Superfan score</p>
            <p className="tabular text-3xl font-semibold tracking-tight">7,240</p>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium">Top 2%</span>
        </div>
      </div>
    </div>
  );
}
