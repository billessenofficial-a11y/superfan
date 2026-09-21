import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function FanDetailLoading() {
  return (
    <div className="animate-fade-in">
      <Skeleton className="mb-4 h-4 w-24" />
      <div className="card-surface flex items-center gap-5 p-6">
        <Skeleton className="size-20 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="mt-2 h-4 w-72" />
          <Skeleton className="mt-2 h-4 w-40" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-surface px-5 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <CardSkeleton lines={8} />
          <CardSkeleton lines={8} />
        </div>
        <div className="flex flex-col gap-4">
          <CardSkeleton lines={5} />
          <CardSkeleton lines={4} />
        </div>
      </div>
    </div>
  );
}
