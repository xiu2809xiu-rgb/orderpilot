import { useState } from "react";
import { prefersReducedMotion } from "@/components/kit/env";
import { cn } from "@/lib/utils";
import "./chip.css";

/**
 * The number on a Filters button: nothing when it is 0, and a short bump each
 * time it changes (not when the page opens with it). The badge stays mounted
 * at 0, which is how it knows 0 to 1 is a change. Its words for a screen
 * reader are the label the caller gives, whatever the motion.
 */
export function CountBadge({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  const [seen, setSeen] = useState(count);
  const [bumps, setBumps] = useState(0);
  if (seen !== count) {
    setSeen(count);
    if (!prefersReducedMotion()) setBumps((n) => n + 1);
  }
  if (count <= 0) return null;
  return (
    // Keyed on the bump, so each change starts the animation again.
    <span
      key={bumps}
      className={cn("count-badge", className)}
      data-bump={bumps > 0 ? "" : undefined}
      aria-label={label}
    >
      {count}
    </span>
  );
}
