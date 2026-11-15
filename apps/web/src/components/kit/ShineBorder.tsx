// Kit: Magic UI / shine-border. Licence: MIT. Adapted to OrderPilot's tokens.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./kit.css";

interface ShineBorderProps {
  borderWidth?: number;
  /** Seconds for one pass of the shine. */
  duration?: number;
  /** CSS colours: tokens by default. */
  shineColor?: string | readonly string[];
  className?: string;
}

/**
 * A slow shine that travels along the border of its parent, which must be
 * `position: relative` with a radius. It marks the current step of a journey.
 * Under reduced motion the shine stops and the border stays lit.
 */
export function ShineBorder({
  borderWidth = 1,
  duration = 14,
  shineColor = "var(--ring)",
  className,
}: ShineBorderProps) {
  const colours = typeof shineColor === "string" ? [shineColor] : shineColor;
  return (
    <div
      aria-hidden="true"
      className={cn(
        "kit-shine pointer-events-none absolute inset-0 size-full rounded-[inherit]",
        className,
      )}
      style={
        {
          "--kit-shine-width": `${String(borderWidth)}px`,
          "--kit-shine-colour": colours[0] ?? "var(--ring)",
          "--kit-shine-duration": `${String(duration)}s`,
          backgroundImage: `radial-gradient(transparent, transparent, ${colours.join(",")}, transparent, transparent)`,
        } as CSSProperties
      }
    />
  );
}
