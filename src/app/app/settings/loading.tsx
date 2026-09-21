import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="mt-2 h-3 w-64" />
      <Skeleton className="mt-6 h-9 w-full max-w-lg rounded-full" />
      <div className="mt-6 flex flex-col gap-4">
        <CardSkeleton lines={5} />
        <CardSkeleton lines={3} />
      </div>
    </div>
  );
}
