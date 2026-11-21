import { cn } from "@/lib/utils";
import { Bone } from "./Bone";

/** A table in its card: one header row and as many rows as a screen holds. */
export function TableBones({
  rows = 8,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("dx-card dx-card-work overflow-hidden", className)}
    >
      <div className="flex items-center gap-6 border-b border-border px-4 py-3">
        <Bone className="h-3.5 w-20" />
        <Bone className="h-3.5 w-32" />
        <Bone className="hidden h-3.5 w-24 sm:block" />
        <Bone className="ml-auto hidden h-3.5 w-20 sm:block" />
      </div>
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex h-11 items-center gap-6 border-b border-border/60 px-4 last:border-b-0"
        >
          <Bone className="h-4 w-20" />
          <Bone className="h-4 w-40 max-w-[40%]" />
          <Bone className="hidden h-4 w-28 sm:block" />
          <Bone className="ml-auto hidden h-4 w-24 sm:block" />
        </div>
      ))}
    </div>
  );
}
