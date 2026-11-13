import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../kit/env";

/** Milliseconds between steps of the stream, and how many words each step adds. */
const STEP_MS = 38;
const WORDS_PER_STEP = 2;

/**
 * Reveals `text` a couple of words at a time while `active`, then calls
 * `onDone` once. Under reduced motion the whole text is there at once. When the
 * turn is already over (`active` false and `settled` true) it shows everything.
 */
export function useWordStream(
  text: string,
  active: boolean,
  settled: boolean,
  onDone: () => void,
): string {
  const words = text.split(" ");
  const [count, setCount] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });

  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) {
      setCount(words.length);
      done.current();
      return;
    }
    let shown = 0;
    const timer = window.setInterval(() => {
      shown = Math.min(words.length, shown + WORDS_PER_STEP);
      setCount(shown);
      if (shown >= words.length) {
        window.clearInterval(timer);
        done.current();
      }
    }, STEP_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [active, words.length]);

  return settled ? text : words.slice(0, count).join(" ");
}
