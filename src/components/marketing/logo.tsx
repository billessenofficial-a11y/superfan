import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 text-sm font-semibold tracking-tight", className)}>
      <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 text-white">★</span>
      Superfan
    </Link>
  );
}
