// Kit: Magic UI / border-beam. Licence: MIT. Adapted to OrderPilot's tokens.
import { motion } from "motion/react";
import { useStill } from "./env";

interface BorderBeamProps {
  /** Length of the beam in pixels. */
  size?: number;
  /** Seconds for one lap. */
  duration?: number;
  /** CSS colours: tokens by default. */
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
}

/**
 * A light that runs once round the border of its parent, which must be
 * `position: relative` with its own radius. Use it on the one thing that is
 * working right now (Spark's input, the current step), not on a list. Under
 * reduced motion it is not drawn: the element's own border stays.
 */
export function BorderBeam({
  size = 64,
  duration = 6,
  colorFrom = "var(--ring)",
  colorTo = "var(--info)",
  borderWidth = 1,
}: BorderBeamProps) {
  const still = useStill();
  if (still) return null;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={{ borderWidth }}
    >
      <motion.div
        className="absolute aspect-square bg-linear-to-l from-(--beam-from) via-(--beam-to) to-transparent"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${String(size)}px)`,
            "--beam-from": colorFrom,
            "--beam-to": colorTo,
          } as React.CSSProperties
        }
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: ["0%", "100%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration }}
      />
    </div>
  );
}
