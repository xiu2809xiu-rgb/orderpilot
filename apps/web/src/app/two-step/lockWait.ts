const MINUTE = 60;
const HOUR = 60 * MINUTE;
/** Up to and including this wait, a lock is told in minutes. */
const MINUTES_UP_TO = 90 * MINUTE;

export type LockWait = { unit: "minutes" | "hours"; count: number } | null;

/**
 * How a lock's wait reads on screen, from the Retry-After header in whole
 * seconds. Up to 90 minutes it is minutes rounded up (900 s is 15 minutes);
 * above that it is hours rounded up (86,400 s is 24 hours). A missing header
 * gives null, and the screen shows the plain locked text instead.
 */
export function lockWait(seconds: number | null): LockWait {
  if (seconds === null || seconds < 0) return null;
  if (seconds <= MINUTES_UP_TO) {
    return { unit: "minutes", count: Math.max(1, Math.ceil(seconds / MINUTE)) };
  }
  return { unit: "hours", count: Math.ceil(seconds / HOUR) };
}
