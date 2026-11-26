import { useState } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  /** The real progress, from 0 to 100. Never a guess and never a timer. */
  value: number;
  /** What is in progress, for a screen reader: "Progress for report.pdf". */
  label: string;
  className?: string;
}

/** Whole percent, held to 0 to 100; a value that is not a number counts as 0. */
function clamp(value: number): number {
  return Number.isFinite(value)
    ? Math.min(100, Math.max(0, Math.round(value)))
    : 0;
}

/**
 * A bar that shows only progress that has really been made. The fill glides
 * from one real value to the next (160 ms, ease-out; none under reduced
 * motion) and never moves backwards: a late, smaller reading leaves it where it
 * is. It does not run on its own, so with no new value it stands still. When
 * the total is not known, show no bar at all.
 */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const next = clamp(value);
  const [shown, setShown] = useState(next);
  // Raised during render, not in an effect, so that the first paint with a
  // larger value already has it and the bar never lags a frame behind.
  if (next > shown) setShown(next);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={shown}
      className={cn("h-1.5 w-full overflow-hidden bg-muted", className)}
    >
      <div
        data-slot="progress-fill"
        className="h-full bg-ring transition-[width] duration-(--motion-fast) ease-(--ease-out) motion-reduce:transition-none"
        style={{ width: `${String(shown)}%` }}
      />
    </div>
  );
}
