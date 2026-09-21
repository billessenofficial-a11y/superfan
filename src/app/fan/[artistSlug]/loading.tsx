import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function PassportLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <CardSkeleton lines={2} />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={2} />
    </div>
  );
}
