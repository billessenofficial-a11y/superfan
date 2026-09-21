import { BadgeCheck, FileCheck2, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const META: Record<string, { label: string; variant: "success" | "warning" | "info" | "outline"; icon: React.ReactNode }> = {
  verified: { label: "Verified", variant: "success", icon: <BadgeCheck /> },
  self_reported: { label: "Self-reported", variant: "warning", icon: <UserRound /> },
  artist_verified: { label: "Artist-verified", variant: "info", icon: <ShieldCheck /> },
  imported: { label: "Imported", variant: "outline", icon: <FileCheck2 /> },
};

export function VerificationBadge({ verification, className, iconOnly = false }: { verification: string; className?: string; iconOnly?: boolean }) {
  const meta = META[verification] ?? { label: verification, variant: "outline" as const, icon: null };
  if (iconOnly) {
    return (
      <span title={meta.label} className={cn("inline-flex [&>svg]:size-3.5", meta.variant === "success" ? "text-success" : meta.variant === "warning" ? "text-warning" : meta.variant === "info" ? "text-info" : "text-subtle", className)}>
        {meta.icon}
      </span>
    );
  }
  return (
    <Badge variant={meta.variant} className={className}>
      {meta.icon}
      {meta.label}
    </Badge>
  );
}
