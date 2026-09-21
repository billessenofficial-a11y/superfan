import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Skeleton className="h-7 w-72" />
        <Skeleton className="mt-2 h-4 w-52" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-surface px-5 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-56 w-full" />
        </div>
        <CardSkeleton lines={6} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
        <CardSkeleton lines={5} />
      </div>
    </div>
  );
}
