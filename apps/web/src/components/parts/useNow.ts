import { useEffect, useState } from "react";

const TICK_MS = 30_000;

/**
 * The current time, refreshed every 30 seconds. A caller that passes `fixed`
 * (a test, or a picture that must not change) gets that time and no clock at
 * all, and the test runner never starts one, so nothing ticks under test.
 */
export function useNow(fixed?: Date): Date {
  const [now, setNow] = useState(() => fixed ?? new Date());
  useEffect(() => {
    if (fixed || import.meta.env.MODE === "test") return;
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, TICK_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [fixed]);
  return fixed ?? now;
}
