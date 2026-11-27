import { TWO_STEP_RULES } from "./two-step-rules.js";

/** The counters one person's row keeps. A fresh row has all of them empty. */
export interface TryState {
  /** The newest (at most) ten wrong-code times, oldest first. */
  readonly failedAt: readonly Date[];
  readonly lockedUntil: Date | null;
  /** Locks since the last success. */
  readonly locksInARow: number;
  /** Kept through a success, so the owner can be told of a lock they did not see. */
  readonly lastLockedAt: Date | null;
}

export const EMPTY_TRY_STATE: TryState = {
  failedAt: [],
  lockedUntil: null,
  locksInARow: 0,
  lastLockedAt: null,
};

const SECOND = 1000;

/**
 * The counters as pure functions of the state and the time. They are the rules
 * that bound someone who knows the password and guesses codes: ten wrong
 * codes inside 15 minutes lock six-digit entry, across every sign-in of the
 * person, and the third lock in a row lasts 24 hours (ADR 0068, section 2.3).
 */
export function isLocked(state: TryState, now: Date): boolean {
  return state.lockedUntil !== null && state.lockedUntil > now;
}

/** Whole seconds left on a lock, rounded up, for the Retry-After header. Zero when not locked. */
export function lockRemainingSeconds(state: TryState, now: Date): number {
  if (state.lockedUntil === null || !isLocked(state, now)) return 0;
  return Math.ceil((state.lockedUntil.getTime() - now.getTime()) / SECOND);
}

export interface FailureResult {
  readonly state: TryState;
  /** True when this wrong code was the one that placed a lock. */
  readonly lockedNow: boolean;
}

/**
 * One more wrong code. Keeps the newest ten. When the tenth falls inside the
 * window of the first, a lock is placed and the list starts again, so the
 * tries are counted afresh once the lock is over.
 */
export function afterFailure(state: TryState, now: Date): FailureResult {
  const failedAt = [...state.failedAt, now].slice(
    -TWO_STEP_RULES.failuresToLock,
  );
  const oldest = failedAt[0];
  const locks =
    failedAt.length >= TWO_STEP_RULES.failuresToLock &&
    oldest !== undefined &&
    now.getTime() - oldest.getTime() <=
      TWO_STEP_RULES.failureWindowSeconds * SECOND;
  if (!locks) return { state: { ...state, failedAt }, lockedNow: false };
  const locksInARow = state.locksInARow + 1;
  const seconds =
    locksInARow >= TWO_STEP_RULES.longLockFromCount
      ? TWO_STEP_RULES.longLockSeconds
      : TWO_STEP_RULES.lockSeconds;
  return {
    state: {
      failedAt: [],
      lockedUntil: new Date(now.getTime() + seconds * SECOND),
      locksInARow,
      lastLockedAt: now,
    },
    lockedNow: true,
  };
}

/** A success clears the list, the lock and the count, but never when the last lock was. */
export function afterSuccess(state: TryState): TryState {
  return {
    failedAt: [],
    lockedUntil: null,
    locksInARow: 0,
    lastLockedAt: state.lastLockedAt,
  };
}

/** True when a lock was placed within the last 7 days. */
export function lockedRecently(lastLockedAt: Date | null, now: Date): boolean {
  if (lastLockedAt === null) return false;
  const age = now.getTime() - lastLockedAt.getTime();
  return age < TWO_STEP_RULES.recentLockDays * 86_400 * SECOND;
}

/** The fifth wrong code on one challenge ends it. */
export function challengeEnds(wrongTries: number): boolean {
  return wrongTries >= TWO_STEP_RULES.wrongPerChallenge;
}
