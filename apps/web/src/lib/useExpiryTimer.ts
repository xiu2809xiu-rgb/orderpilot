import { useEffect, useRef } from "react";

const MIN_DELAY_MS = 1_000;
// A value lasts 12 hours, so a longer wait means a wrong clock; setTimeout also breaks above 2^31 ms.
const MAX_DELAY_MS = 24 * 3_600_000;
// A little after the server's moment, so the server has already let go.
const SLACK_MS = 250;
const FIRST_RETRY_MS = 30_000;
const MAX_RETRY_MS = 300_000;

/**
 * Asks again when a value is due to end. The server decides when it ends, so a
 * browser whose clock runs ahead may ask too early and be told "still live":
 * it then waits 30 s, 60 s, 120 s and so on up to 5 minutes, so a skewed
 * laptop makes only a few requests (the default limit is shared by everyone
 * behind one address). `ask` answers with the end the server still names, or
 * null when it has ended. The timer is cleared when the end changes or the
 * component goes away.
 */
export function useExpiryTimer(
  expiresAt: string | null,
  ask: () => Promise<string | null>,
): void {
  const latest = useRef(ask);
  useEffect(() => {
    latest.current = ask;
  });

  useEffect(() => {
    if (expiresAt === null) return;
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = (delay: number) => {
      timer = setTimeout(() => {
        void run();
      }, delay);
    };
    const run = async () => {
      const still = await latest.current();
      // Ended or renewed: the effect runs again for the new end, or not at all.
      if (stopped || still !== expiresAt) return;
      attempt += 1;
      arm(Math.min(FIRST_RETRY_MS * 2 ** (attempt - 1), MAX_RETRY_MS));
    };

    arm(
      Math.min(
        MAX_DELAY_MS,
        Math.max(MIN_DELAY_MS, Date.parse(expiresAt) - Date.now() + SLACK_MS),
      ),
    );
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [expiresAt]);
}
