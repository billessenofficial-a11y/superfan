import { Skeleton } from "@/components/ui/skeleton";

export default function FanLoading() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-16 sm:max-w-2xl sm:px-6">
      <div className="flex items-center justify-between py-4">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-7 w-16" />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Skeleton className="size-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="mt-8 space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-52 w-full rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
