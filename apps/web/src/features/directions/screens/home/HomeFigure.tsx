import { useEffect, useRef, useState } from "react";
import { NumberTicker } from "@/components/kit/NumberTicker";

/** The count takes about a second; after that the figure is plain text. */
const COUNT_MS = 1400;
const PLAIN_WEIGHT = { fontWeight: "inherit" } as const;

/**
 * A figure that counts up once, when Home opens, and is only text after that.
 * The kit's ticker counts again from zero whenever its value changes, and a
 * count that replays when a task is completed or a list refetches would move
 * numbers under a person who is working. So a figure that changes while it is
 * counting, or after it has counted, is simply shown.
 */
export function HomeFigure({ value }: { value: number }) {
  const first = useRef(value);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setSettled(true);
    }, COUNT_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, []);
  if (settled || value !== first.current) {
    return <span className="tabular-nums">{value}</span>;
  }
  // The sentence is body text: its figures keep its weight, not the numeral's.
  return <NumberTicker value={first.current} style={PLAIN_WEIGHT} />;
}
