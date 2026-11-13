// Kit: Magic UI / animated-circular-progress-bar. Licence: MIT. Adapted to OrderPilot's tokens.
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  min?: number;
  max?: number;
  /** The accessible name, for example "Stock cover". */
  label: string;
  /** What the centre shows: the value as a percentage by default. */
  children?: ReactNode;
  /** Side of the ring in pixels. */
  size?: number;
  className?: string;
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * A ring that fills to a value, in the accent over a muted track. The ring
 * eases to its value through a CSS transition (off under reduced motion).
 * It is a real progressbar, so the number is read aloud with its label.
 */
export function CircularProgress({
  value,
  min = 0,
  max = 100,
  label,
  children,
  size = 96,
  className,
}: CircularProgressProps) {
  const span = max - min;
  const ratio = span === 0 ? 0 : Math.min(1, Math.max(0, (value - min) / span));
  const percent = Math.round(ratio * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        className="size-full -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          strokeWidth="9"
          className="stroke-muted"
        />
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          strokeWidth="9"
          strokeLinecap="round"
          className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
        />
      </svg>
      <span className="numeral fs-16 absolute inset-0 flex items-center justify-center text-foreground">
        {children ?? `${String(percent)}%`}
      </span>
    </div>
  );
}
