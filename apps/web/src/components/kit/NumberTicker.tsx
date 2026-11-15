// Kit: Magic UI / number-ticker. Licence: MIT. Adapted to OrderPilot's tokens.
import { animate } from "motion/react";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { useOnScreen, useStill } from "./env";

type NumberTickerProps = Omit<ComponentProps<"span">, "children"> & {
  value: number;
  startValue?: number;
  decimalPlaces?: number;
  /** Seconds to wait once the number is on screen. */
  delay?: number;
  /** Overrides the grouping, for money or a unit. */
  format?: (value: number) => string;
};

/**
 * A figure that counts up once, the first time it is on screen. Under reduced
 * motion, and where on-screen cannot be known (tests), it shows the final
 * value at once. The number is always in the markup, so a screen reader reads
 * the real value, not the count in between.
 */
export function NumberTicker({
  value,
  startValue = 0,
  decimalPlaces = 0,
  delay = 0,
  format,
  className,
  ...props
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const still = useStill();
  const seen = useOnScreen(ref, { once: true });
  const [shown, setShown] = useState(still ? value : startValue);

  useEffect(() => {
    if (still) {
      setShown(value);
      return;
    }
    if (!seen) return;
    const controls = animate(startValue, value, {
      type: "spring",
      stiffness: 100,
      damping: 60,
      delay,
      onUpdate: setShown,
    });
    return () => {
      controls.stop();
    };
  }, [still, seen, value, startValue, delay]);

  const text = format
    ? format(shown)
    : new Intl.NumberFormat("en-US", {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(shown);

  return (
    <span
      ref={ref}
      className={cn("numeral inline-block tabular-nums", className)}
      {...props}
    >
      {text}
    </span>
  );
}
