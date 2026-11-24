import { describe, expect, it } from "vitest";
import { FIXED_NOW } from "../../../test/support/two-step.js";
import {
  EMPTY_TRY_STATE,
  afterFailure,
  afterSuccess,
  challengeEnds,
  isLocked,
  lockRemainingSeconds,
  lockedRecently,
  type TryState,
} from "./try-limits.js";

const SECOND = 1000;
const at = (seconds: number) =>
  new Date(FIXED_NOW.getTime() + seconds * SECOND);

/** Applies `count` wrong codes, one every `gapSeconds`, starting at `startSeconds`. */
function fail(
  state: TryState,
  count: number,
  gapSeconds = 1,
  startSeconds = 0,
): { state: TryState; lockedNow: boolean; last: Date } {
  let current = state;
  let lockedNow = false;
  let last = at(startSeconds);
  for (let n = 0; n < count; n += 1) {
    last = at(startSeconds + n * gapSeconds);
    const result = afterFailure(current, last);
    current = result.state;
    lockedNow = result.lockedNow;
  }
  return { state: current, lockedNow, last };
}

describe("try limits", () => {
  it("keeps only the newest ten failures", () => {
    // Spaced so wide that none can lock: only the list length is under test.
    const { state } = fail(EMPTY_TRY_STATE, 14, 1000);
    expect(state.failedAt).toHaveLength(10);
    expect(state.failedAt[0]).toEqual(at(4 * 1000));
    expect(state.failedAt[9]).toEqual(at(13 * 1000));
  });

  it("locks on the tenth wrong code inside 15 minutes", () => {
    const nine = fail(EMPTY_TRY_STATE, 9, 10);
    expect(nine.lockedNow).toBe(false);
    expect(isLocked(nine.state, nine.last)).toBe(false);
    const tenth = afterFailure(nine.state, at(90));
    expect(tenth.lockedNow).toBe(true);
    expect(isLocked(tenth.state, at(90))).toBe(true);
  });

  it("does not lock when the first of the ten is older than 15 minutes", () => {
    // Ten codes spread over 15 minutes and one second.
    const result = fail(EMPTY_TRY_STATE, 10, 100.1);
    expect(result.last.getTime() - FIXED_NOW.getTime()).toBeGreaterThan(
      900 * SECOND,
    );
    expect(result.lockedNow).toBe(false);
    // Exactly 15 minutes still counts as inside the window.
    const exact = fail(EMPTY_TRY_STATE, 10, 100);
    expect(exact.last.getTime() - FIXED_NOW.getTime()).toBe(900 * SECOND);
    expect(exact.lockedNow).toBe(true);
  });

  it("locks for 15 minutes the first and the second time and for 24 hours from the third in a row", () => {
    let state: TryState = EMPTY_TRY_STATE;
    const seconds: number[] = [];
    for (let round = 0; round < 4; round += 1) {
      const start = round * 100_000;
      const result = fail(state, 10, 1, start);
      expect(result.lockedNow).toBe(true);
      const lockedUntil = result.state.lockedUntil;
      expect(lockedUntil).not.toBeNull();
      seconds.push(
        ((lockedUntil?.getTime() ?? 0) - result.last.getTime()) / SECOND,
      );
      // The next round starts after this lock is over, with no success between.
      state = result.state;
    }
    expect(seconds).toEqual([900, 900, 86_400, 86_400]);
  });

  it("starts counting afresh once a lock is placed", () => {
    const locked = fail(EMPTY_TRY_STATE, 10).state;
    expect(locked.failedAt).toEqual([]);
    expect(locked.locksInARow).toBe(1);
  });

  it("clears the list, the lock and the count after a success", () => {
    const locked = fail(EMPTY_TRY_STATE, 10).state;
    const cleared = afterSuccess({ ...locked, failedAt: [at(5)] });
    expect(cleared.failedAt).toEqual([]);
    expect(cleared.lockedUntil).toBeNull();
    expect(cleared.locksInARow).toBe(0);
  });

  it("ends a challenge on the fifth wrong try", () => {
    expect([0, 1, 2, 3, 4].map(challengeEnds)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(challengeEnds(5)).toBe(true);
    expect(challengeEnds(6)).toBe(true);
  });

  it("sets lastLockedAt when it locks and keeps it after a success", () => {
    const result = fail(EMPTY_TRY_STATE, 10);
    expect(result.state.lastLockedAt).toEqual(result.last);
    expect(afterSuccess(result.state).lastLockedAt).toEqual(result.last);
    // A failure that does not lock leaves it alone.
    const more = afterFailure(afterSuccess(result.state), at(1000));
    expect(more.state.lastLockedAt).toEqual(result.last);
  });

  it("says a lock is recent for 7 days and not after", () => {
    const seven = 7 * 86_400;
    expect(lockedRecently(null, FIXED_NOW)).toBe(false);
    expect(lockedRecently(FIXED_NOW, at(seven - 1))).toBe(true);
    expect(lockedRecently(FIXED_NOW, at(seven))).toBe(false);
  });

  it("gives the seconds left on a lock, rounded up", () => {
    const locked = fail(EMPTY_TRY_STATE, 10).state;
    const placed = at(9);
    expect(lockRemainingSeconds(locked, placed)).toBe(900);
    expect(lockRemainingSeconds(locked, new Date(placed.getTime() + 100))).toBe(
      900,
    );
    expect(
      lockRemainingSeconds(locked, new Date(placed.getTime() + 899_500)),
    ).toBe(1);
    expect(lockRemainingSeconds(locked, at(9 + 900))).toBe(0);
    expect(lockRemainingSeconds(EMPTY_TRY_STATE, at(9))).toBe(0);
  });
});
