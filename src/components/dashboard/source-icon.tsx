import { FileSpreadsheet, Hand, Star } from "lucide-react";
import { ProviderIcon } from "@/components/shared/provider-icon";
import { cn } from "@/lib/utils";

export const SOURCE_LABELS: Record<string, string> = {
  instagram: "Instagram",
  shopify: "Shopify",
  superfan: "Superfan",
  csv: "Import",
  spotify: "Spotify",
  tiktok: "TikTok",
  ticketmaster: "Ticketmaster",
  manual: "Manual",
};

/** Monochrome icon for an event source (provider marks + app-level sources). */
export function SourceIcon({ source, className, size = 14 }: { source: string; className?: string; size?: number }) {
  const cls = cn("shrink-0", className);
  switch (source) {
    case "superfan":
      return <Star width={size} height={size} className={cls} aria-hidden />;
    case "csv":
      return <FileSpreadsheet width={size} height={size} className={cls} aria-hidden />;
    case "manual":
      return <Hand width={size} height={size} className={cls} aria-hidden />;
    default:
      return <ProviderIcon provider={source} size={size} className={cls} />;
  }
}

/** Small rounded chip with the source mark + label. */
export function SourceBadge({ source, className }: { source: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground", className)}>
      <SourceIcon source={source} size={12} />
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}
