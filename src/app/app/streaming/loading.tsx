import { Skeleton } from "@/components/ui/skeleton";

export default function StreamingLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}
