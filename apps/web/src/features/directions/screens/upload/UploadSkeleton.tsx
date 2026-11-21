import { Skeleton } from "@/components/ui/skeleton";

/** The upload screen's own shape while its chunk loads: the head and the drop zone. */
export function UploadSkeleton() {
  return (
    <div className="dx-sheet flex flex-col gap-6" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
