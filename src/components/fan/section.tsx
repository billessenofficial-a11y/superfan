import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Section heading with optional "See all" link, used across the passport. */
export function PassportSection({ title, href, hrefLabel = "See all", children, className, id }: { title: string; href?: string; hrefLabel?: string; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cn("animate-rise", className)}>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {href ? (
          <Link href={href} className="inline-flex items-center gap-0.5 text-xs font-medium text-artist hover:underline">
            {hrefLabel} <ChevronRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
