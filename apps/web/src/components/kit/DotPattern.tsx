// Kit: Magic UI / dot-pattern. Licence: MIT. Adapted to OrderPilot's tokens.
import { useId } from "react";
import { cn } from "@/lib/utils";

interface DotPatternProps {
  /** Spacing between dots, in pixels. */
  gap?: number;
  /** Dot radius, in pixels. */
  radius?: number;
  /** Fade the dots out towards the edges, so text on top stays clear. */
  fade?: boolean;
  className?: string;
}

/**
 * A field of dots, drawn once as an SVG pattern (Magic UI draws one circle per
 * dot; a pattern is the same picture with one element). The colour is the
 * text colour of the element, so set it with a token. It never moves.
 */
export function DotPattern({
  gap = 16,
  radius = 1,
  fade = true,
  className,
}: DotPatternProps) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full text-(--border-strong)",
        fade &&
          "[mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_80%)]",
        className,
      )}
    >
      <defs>
        <pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
          <circle cx={radius} cy={radius} r={radius} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
