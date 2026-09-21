import * as React from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
  compact = false,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("card-surface flex flex-col items-center justify-center text-center", compact ? "px-6 py-10" : "px-6 py-16 sm:py-20", className)}>
      {icon ? (
        <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent [&>svg]:size-6">{icon}</div>
      ) : null}
      <h3 className="text-base font-semibold tracking-tight text-balance">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-muted-foreground text-balance">{description}</p> : null}
      {actions ? <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}
