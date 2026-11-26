import { Skeleton } from "@/components/ui/skeleton";

/**
 * A block that is still loading: a skeleton for the eye and a polite status for
 * a screen reader. A label on the block itself is not allowed, since a plain
 * div has no role to carry one.
 */
export function VersionsLoading({
  label,
  height = "h-24",
}: {
  label: string;
  height?: string;
}) {
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {label}
      </p>
      <Skeleton className={height} />
    </div>
  );
}
