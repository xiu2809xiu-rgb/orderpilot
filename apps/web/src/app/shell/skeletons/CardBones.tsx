import { cn } from "@/lib/utils";
import { Bone } from "./Bone";

/** A glass card with a title and some lines, the shape of a Section. */
export function CardBones({
  lines = 4,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("dx-card flex flex-col gap-4 p-6", className)}
    >
      <Bone className="h-5 w-40" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: lines }, (_, index) => (
          <Bone
            key={index}
            className={cn("h-4", index % 3 === 2 ? "w-2/3" : "w-full")}
          />
        ))}
      </div>
    </div>
  );
}
