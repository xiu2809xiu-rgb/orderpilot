import { useEffect, useRef, useState } from "react";
import { useOnScreen, useStill } from "@/components/kit/env";

const DURATION_MS = 700;

function decimalsOf(value: number): number {
  return value.toString().split(".")[1]?.length ?? 0;
}

/**
 * A number that counts up once, the first time it is on screen: the idea of
 * the kit's ticker (components/kit/NumberTicker) without its animation
 * library, which would add to the entry chunk that this piece belongs to.
 * Both share the rule for stillness: a person who asks for reduced motion, and
 * a test, see the final value at once. The figure is tabular so the digits do
 * not shift while it counts, and a screen reader only ever gets the final
 * value.
 */
export function NumberTicker({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useStill();
  const seen = useOnScreen(ref, { once: true });
  const [shown, setShown] = useState(still ? value : 0);

  useEffect(() => {
    if (still) {
      setShown(value);
      return;
    }
    if (!seen) return;
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
  }, [still, seen, value]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className="numeral">
        {shown.toFixed(decimalsOf(value))}
      </span>
      <span className="sr-only">{value}</span>
    </>
  );
}
