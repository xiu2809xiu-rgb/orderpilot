import type { TFunction } from "i18next";
import { ApiError } from "@/lib/api/errors";
import { describeError } from "@/lib/errors";
import { lockWait } from "./lockWait";

/** Which proof was sent: the six digits from the app, or one recovery code. */
export type TwoStepMode = "app" | "recovery";

export interface TwoStepFailure {
  message: string;
  traceId: string | undefined;
}

/** True when the sign-in attempt is over and the person must start again. */
export function isChallengeEnded(error: unknown): boolean {
  return error instanceof ApiError && error.code === "TWO_STEP_CHALLENGE_ENDED";
}

/** A wrong or refused code: the field shows it red, then clears. */
export function isWrongCode(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === "TWO_STEP_CODE_INVALID" || error.code === "TWO_STEP_LOCKED")
  );
}

/**
 * The words for a failed two-step call. A lock says how long to wait, from the
 * Retry-After header; without the header it falls back to the plain text of
 * the error code. A wrong recovery code has words of its own: the common text
 * for the code tells the person to wait for the next one and check the phone's
 * clock, which has nothing to do with a code that never changes. `tCommon` is
 * the common namespace, `tSignin` the sign-in one (the lock and recovery texts
 * live there, so the settings dialogs read it too).
 */
export function describeTwoStepFailure(
  error: unknown,
  tCommon: TFunction,
  tSignin: TFunction,
  mode: TwoStepMode = "app",
): TwoStepFailure {
  const base = describeError(error, tCommon);
  if (!(error instanceof ApiError)) return base;
  if (error.code === "TWO_STEP_CODE_INVALID" && mode === "recovery") {
    return { ...base, message: tSignin("twoStep.recovery.wrong") };
  }
  if (error.code !== "TWO_STEP_LOCKED") return base;
  const wait = lockWait(error.retryAfterSeconds);
  if (wait === null) return base;
  const key =
    wait.unit === "minutes" ? "twoStep.lockedIn" : "twoStep.lockedInHours";
  return { ...base, message: tSignin(key, { count: wait.count }) };
}
