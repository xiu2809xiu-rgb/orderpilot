// Kit: Magic UI / grid-pattern. Licence: MIT. Adapted to OrderPilot's tokens.
import { useId } from "react";
import { cn } from "@/lib/utils";

interface GridPatternProps {
  /** Cell size in pixels. */
  cell?: number;
  fade?: boolean;
  className?: string;
}

/**
 * Ruled lines in a grid, one pixel wide, in the text colour of the element
 * (set it with a token). It is Paper's ledger paper where a screen wants the
 * rules to show behind a headline. It never moves.
 */
export function GridPattern({
  cell = 40,
  fade = true,
  className,
}: GridPatternProps) {
  const id = useId();
  const size = String(cell);
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full text-(--border)",
        fade &&
          "[mask-image:radial-gradient(ellipse_at_center,#000_40%,transparent_85%)]",
        className,
      )}
    >
      <defs>
        <pattern
          id={id}
          width={cell}
          height={cell}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M.5 ${size}V.5H${size}`}
            fill="none"
            stroke="currentColor"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
