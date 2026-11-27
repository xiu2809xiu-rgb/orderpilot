import { animate } from "motion/react";
import { useEffect, useRef } from "react";
import { useStill } from "../env";
import { codeFieldMotion } from "./codeFieldMotion";

/**
 * Moves the focus ring to a cell. The ring's place is one number, `--cf-i`,
 * that the sheet turns into a translation (the cell's own width plus the gap,
 * so the ring follows a fluid width). A spring moves it because it is spatial
 * movement; under reduced motion, and in the test runner, it is placed at once.
 */
export function useRingSpring(cell: number) {
  const ring = useRef<HTMLSpanElement>(null);
  const still = useStill();

  useEffect(() => {
    const node = ring.current;
    if (!node) return;
    if (still) {
      node.style.setProperty("--cf-i", String(cell));
      return;
    }
    const controls = animate(
      node,
      { "--cf-i": cell },
      {
        type: "spring",
        ...codeFieldMotion.ringSpring,
      },
    );
    return () => {
      controls.stop();
    };
  }, [cell, still]);

  return ring;
}
