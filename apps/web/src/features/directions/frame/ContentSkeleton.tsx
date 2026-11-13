import { Skeleton } from "@/components/ui/skeleton";

/** The shape of a typical screen: a heading, three cards and a table. */
export function ContentSkeleton() {
  return (
    <div
      className="mx-auto flex max-w-6xl flex-col gap-6 p-6"
      aria-hidden="true"
    >
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
