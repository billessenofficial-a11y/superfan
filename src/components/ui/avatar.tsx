"use client";

import * as React from "react";
import { cn, gradientFor, initials } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  rounded?: "full" | "xl";
};

/**
 * Avatar with graceful fallback: a deterministic gradient + initials when
 * there is no image or it fails to load.
 */
export function Avatar({ src, name, size = 36, className, rounded = "full" }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const label = name ?? "";
  const radius = rounded === "full" ? "rounded-full" : "rounded-2xl";
  const showImage = src && !failed;
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden text-white select-none", radius, className)}
      style={{ width: size, height: size, background: showImage ? undefined : gradientFor(label || "fan"), fontSize: Math.max(10, size * 0.38) }}
      aria-label={label || undefined}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} width={size} height={size} className="size-full object-cover" onError={() => setFailed(true)} loading="lazy" />
      ) : (
        <span className="font-semibold tracking-tight">{initials(label)}</span>
      )}
    </span>
  );
}

export function AvatarStack({ items, size = 28, max = 4 }: { items: { src?: string | null; name?: string | null }[]; size?: number; max?: number }) {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  return (
    <span className="inline-flex items-center">
      {shown.map((it, i) => (
        <span key={i} className="rounded-full ring-2 ring-card" style={{ marginLeft: i === 0 ? 0 : -size * 0.3 }}>
          <Avatar src={it.src} name={it.name} size={size} />
        </span>
      ))}
      {rest > 0 ? (
        <span className="ml-1.5 text-xs text-muted-foreground">+{rest}</span>
      ) : null}
    </span>
  );
}
