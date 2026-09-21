import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-muted text-foreground",
        outline: "border-border-strong text-muted-foreground",
        accent: "border-transparent bg-accent-soft text-accent",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
        danger: "border-transparent bg-danger-soft text-danger",
        info: "border-transparent bg-info-soft text-info",
        artist: "border-transparent bg-artist/15 text-artist",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, style, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} style={style} {...props} />;
}

/** Colored dot + label, e.g. for fan levels with custom colors. */
function LevelBadge({ name, color, className }: { name: string | null | undefined; color?: string | null; className?: string }) {
  if (!name) return <Badge variant="outline" className={className}>Unranked</Badge>;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-[11px] font-medium", className)} style={{ background: `color-mix(in oklab, ${color ?? "#a78bfa"} 16%, transparent)`, color: color ?? "#a78bfa" }}>
      <span className="size-1.5 rounded-full" style={{ background: color ?? "#a78bfa" }} />
      {name}
    </span>
  );
}

export { Badge, LevelBadge, badgeVariants };
