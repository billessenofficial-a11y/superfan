import { cn } from "@/lib/utils";

/** Artist banner image or accent gradient fallback. */
export function ArtistBanner({ src, name, className }: { src: string | null; name: string; className?: string }) {
  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${name} banner`} className="size-full object-cover" />
      ) : (
        <div className="artist-gradient size-full" />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
    </div>
  );
}
