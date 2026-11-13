// Kit: React Bits / GradientText. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import "./kit.css";

interface GradientTextProps {
  children: ReactNode;
  /** CSS colours, two or more: the design tokens by default. */
  colors?: readonly string[];
  /** Seconds for one slow sweep. */
  duration?: number;
  /** A soft blurred copy behind the letters, 0 to 1. */
  glow?: number;
  className?: string;
}

/**
 * Text filled with a slow-moving gradient. It is Spectra's numeral and
 * headline voice. The gradient is only for large type (20 px and up) whose
 * every stop passes 3:1 on the ground; body text never uses it. Under reduced
 * motion the gradient holds still. React Bits drives the sweep from a script;
 * a CSS animation does the same with no frame loop.
 */
export function GradientText({
  children,
  colors = ["var(--dx-title-from)", "var(--dx-title-to)"],
  duration = 8,
  glow = 0,
  className,
}: GradientTextProps) {
  const stops = [...colors, colors[0] ?? "var(--ring)"].join(", ");
  const style = {
    "--kit-gradient": `linear-gradient(100deg, ${stops})`,
    "--kit-gradient-duration": `${String(duration)}s`,
  } as CSSProperties;
  return (
    <span className={cn("relative inline-block", className)} style={style}>
      <span className="kit-gradient-text inline-block">{children}</span>
      {glow > 0 ? (
        <span
          aria-hidden="true"
          className="kit-gradient-text pointer-events-none absolute inset-0 -z-10 inline-block select-none blur-[0.3em]"
          style={{ opacity: Math.min(1, glow) }}
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}
