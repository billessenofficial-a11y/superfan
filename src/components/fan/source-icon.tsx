import { BadgeCheck, FileSpreadsheet, Hand, ShieldCheck, Star, UserRound } from "lucide-react";
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
  manual: "Artist",
};

/** Monochrome icon for an activity source. */
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

const VERIFICATION: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  verified: { label: "Verified", className: "text-success", icon: <BadgeCheck /> },
  artist_verified: { label: "Artist-verified", className: "text-info", icon: <ShieldCheck /> },
  imported: { label: "Imported", className: "text-subtle", icon: <FileSpreadsheet /> },
  self_reported: { label: "Self-reported", className: "text-warning", icon: <UserRound /> },
};

/** Tiny verification mark for the passport activity feed. */
export function VerificationMark({ verification, withLabel = false, className }: { verification: string; withLabel?: boolean; className?: string }) {
  const meta = VERIFICATION[verification] ?? VERIFICATION.imported;
  return (
    <span title={meta.label} className={cn("inline-flex items-center gap-1 text-[11px] font-medium [&>svg]:size-3.5", meta.className, className)}>
      {meta.icon}
      {withLabel ? meta.label : null}
    </span>
  );
}
