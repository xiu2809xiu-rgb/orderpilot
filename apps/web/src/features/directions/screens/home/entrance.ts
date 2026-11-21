import { useEffect, useState, type CSSProperties } from "react";

/** The longest a list takes to arrive: its last entry starts 9 x 30 ms in. */
const LAST_PLACE = 9;

/**
 * True for the first moments after a list mounts, then false for good. The
 * arrival of a list is its first view: an entry that appears later (an Undo, a
 * task that moves up) must not animate, so the class is only worn while this
 * is true. The CSS animation has finished long before it is taken off.
 */
export function useFirstView(ms = 900): boolean {
  const [first, setFirst] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setFirst(false);
    }, ms);
    return () => {
      window.clearTimeout(id);
    };
  }, [ms]);
  return first;
}

/** The class and the place of one entry in the stagger, or nothing once the first view is over. */
export function enterProps(
  place: number,
  first: boolean,
): { className?: string; style?: CSSProperties } {
  if (!first) return {};
  return {
    className: "home-enter",
    style: { "--home-i": Math.min(place, LAST_PLACE) } as CSSProperties,
  };
}
