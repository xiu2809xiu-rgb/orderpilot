import { DomainError } from "../../common/domain-error.js";

/**
 * Six-digit entry is locked. `details` stays null (it is for field issues), so
 * the wait travels in `retryAfterSeconds`, which the controller puts in the
 * standard Retry-After header.
 */
export class TwoStepLockedError extends DomainError {
  constructor(readonly retryAfterSeconds: number) {
    super(
      "TWO_STEP_LOCKED",
      "Too many wrong codes. Wait a while, or use a recovery code.",
    );
  }
}
