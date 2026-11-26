import { Skeleton } from "@/components/ui/skeleton";

/** The card while the owner's picture is being asked for, announced once as loading. */
export function PictureCardLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="flex items-start gap-s4">
      <span className="sr-only">{label}</span>
      <Skeleton className="size-20 rounded-full" aria-hidden="true" />
      <div className="flex flex-1 flex-col gap-s2">
        <Skeleton className="h-4 w-3/4" aria-hidden="true" />
        <Skeleton className="h-4 w-1/2" aria-hidden="true" />
      </div>
    </div>
  );
}
