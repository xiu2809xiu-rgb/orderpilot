import { useEffect, useState } from "react";
import { prefersReducedMotion } from "@/components/kit/env";

/** One pill to draw: a live one, or one that was just cleared and is fading out. */
export interface PillRow<T> {
  chip: T;
  leaving: boolean;
}

interface Gone<T> {
  chip: T;
  /** Where in the row the pill stood, so its ghost fades in the same place. */
  at: number;
}

/** The ghost is dropped by its animation ending, or by this if the animation never runs (a hidden row). */
const GHOST_LIMIT_MS = 400;

/**
 * The pills of an applied-filter row, plus a ghost of each pill that was just
 * cleared. The filter itself changes at once, as it always did: the ghost is
 * only a picture of the pill fading out in the place it stood, so the row
 * never changes height while it fades. Under reduced motion there is no ghost
 * and a cleared pill is gone at once.
 */
export function useLeavingChips<T extends { id: string }>(
  chips: readonly T[],
): { rows: PillRow<T>[]; done: (id: string) => void } {
  const key = chips.map((chip) => chip.id).join("|");
  const [seen, setSeen] = useState({ key, list: chips });
  const [ghosts, setGhosts] = useState<Gone<T>[]>([]);
  if (seen.key !== key) {
    setSeen({ key, list: chips });
    if (!prefersReducedMotion()) {
      const still = (id: string) => chips.some((chip) => chip.id === id);
      const gone = seen.list.flatMap((chip, at) =>
        still(chip.id) ? [] : [{ chip, at }],
      );
      setGhosts((now) => [
        ...now.filter((ghost) => !still(ghost.chip.id)),
        ...gone,
      ]);
    }
  }
  useEffect(() => {
    if (ghosts.length === 0) return;
    const timer = window.setTimeout(() => {
      setGhosts([]);
    }, GHOST_LIMIT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [ghosts]);
  const rows: PillRow<T>[] = chips.map((chip) => ({ chip, leaving: false }));
  for (const ghost of [...ghosts].sort((a, b) => a.at - b.at)) {
    rows.splice(Math.min(ghost.at, rows.length), 0, {
      chip: ghost.chip,
      leaving: true,
    });
  }
  return {
    rows,
    done: (id) => {
      setGhosts((now) => now.filter((ghost) => ghost.chip.id !== id));
    },
  };
}
