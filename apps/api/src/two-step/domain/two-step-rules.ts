/**
 * Every number of the two-step rules in one place (ADR 0067). Seconds unless
 * the name says otherwise.
 */
export const TWO_STEP_RULES = {
  stepSeconds: 30,
  digits: 6,
  /** A code is accepted this many steps either side of the current one. */
  windowSteps: 1,
  /** A sign-in waits this long for its second step. */
  challengeSeconds: 300,
  /** A setup nobody confirmed lapses after this. */
  setupSeconds: 600,
  /** The fifth wrong code on one challenge ends it. */
  wrongPerChallenge: 5,
  /** This many wrong codes inside the window lock the six-digit entry... */
  failuresToLock: 10,
  failureWindowSeconds: 900,
  /** ...for 15 minutes, the first and the second time in a row... */
  lockSeconds: 900,
  /** ...and for 24 hours from the third lock in a row. */
  longLockSeconds: 86_400,
  longLockFromCount: 3,
  /** A lock is shown to its owner for this many days. */
  recentLockDays: 7,
  recoveryCodeCount: 10,
} as const;

/** True once a setup nobody confirmed has lapsed. A setup with no expiry has none to lapse. */
export function setupLapsed(pendingExpiresAt: Date | null, now: Date): boolean {
  return (
    pendingExpiresAt !== null && pendingExpiresAt.getTime() <= now.getTime()
  );
}
