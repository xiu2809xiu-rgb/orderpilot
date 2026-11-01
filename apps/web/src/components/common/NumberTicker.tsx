import { useEffect, useState } from "react";

const DURATION_MS = 700;

function decimalsOf(value: number): number {
  return value.toString().split(".")[1]?.length ?? 0;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A number that counts up once when it first appears, the idea of Magic UI's
 * free ticker without its animation library, which would add to the chunk. A
 * person who asks for reduced motion sees the value at once, and a screen
 * reader only ever gets the final value.
 */
export function NumberTicker({ value }: { value: number }) {
  const [shown, setShown] = useState(() =>
    prefersReducedMotion() ? value : 0,
  );

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - started) / DURATION_MS, 1);
      const eased = 1 - (1 - progress) ** 3;
      setShown(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [value]);

  return (
    <>
      <span aria-hidden="true">{shown.toFixed(decimalsOf(value))}</span>
      <span className="sr-only">{value}</span>
    </>
  );
}
