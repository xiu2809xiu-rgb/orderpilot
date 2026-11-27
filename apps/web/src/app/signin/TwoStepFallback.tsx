import { Skeleton } from "@/components/ui/skeleton";

/** Holds the second step's place while its chunk arrives, so the card does not jump. */
export function TwoStepFallback({ label }: { label: string }) {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{label}</span>
      <Skeleton aria-hidden="true" className="h-7 w-2/5" />
      <Skeleton aria-hidden="true" className="h-14 w-full" />
    </div>
  );
}
