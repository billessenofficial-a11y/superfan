import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <TableSkeleton rows={12} />
    </div>
  );
}
