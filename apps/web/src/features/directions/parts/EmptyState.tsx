import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { BlurFade } from "../kit/BlurFade";
import { DotPattern } from "../kit/DotPattern";

/**
 * What a list or a panel shows when it has nothing: a dotted field, an icon,
 * what is empty, and the way to fill it. It is a show moment, so the words
 * arrive with a blur fade (still under reduced motion); the dots never move.
 * `action` is the one button a person can use next, if there is one.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex flex-col items-center justify-center gap-3 overflow-hidden px-6 py-12 text-center",
        className,
      )}
      style={{ borderRadius: "var(--radius-card)" }}
    >
      <DotPattern gap={14} />
      <BlurFade className="flex flex-col items-center gap-3">
        <span
          className="flex size-12 items-center justify-center border border-border-strong bg-card text-ring"
          style={{ borderRadius: "var(--radius-control)" }}
        >
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <p className="fs-16 font-semibold text-foreground">{title}</p>
        <p className="fs-14 max-w-prose text-muted-foreground">{description}</p>
        {action}
      </BlurFade>
    </div>
  );
}
