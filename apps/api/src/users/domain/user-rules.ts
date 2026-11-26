import { ConflictError } from "../../common/domain-error.js";

/** Whether a person is acting on their own account. */
export function isSelf(actorId: string, targetId: string): boolean {
  return actorId === targetId;
}

/**
 * An administrator may not reset their own two-step verification: the reset is
 * the way back in for someone else, so a second person has to do it.
 */
export function assertNotSelfForReset(actorId: string, targetId: string): void {
  if (isSelf(actorId, targetId)) {
    throw new ConflictError("You cannot reset your own two-step verification.");
  }
}

/**
 * Resetting another person's two-step is off in production, on purpose: it lets
 * an administrator who knows a password sign in as that person, and nobody is
 * told it happened. Production's behaviour is decided here, not left to follow
 * from production having no password sign-in (ADR 0068, decision 9).
 */
export function assertResetAllowedHere(isProduction: boolean): void {
  if (isProduction) {
    throw new ConflictError(
      "Resetting another person's two-step verification is switched off in production until that person is told about it.",
    );
  }
}

/** An administrator may not lock themselves out: someone else has to do it. */
export function assertNotSelf(actorId: string, targetId: string): void {
  if (isSelf(actorId, targetId)) {
    throw new ConflictError("You cannot disable your own account.");
  }
}
