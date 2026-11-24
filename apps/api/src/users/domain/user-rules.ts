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

/** An administrator may not lock themselves out: someone else has to do it. */
export function assertNotSelf(actorId: string, targetId: string): void {
  if (isSelf(actorId, targetId)) {
    throw new ConflictError("You cannot disable your own account.");
  }
}
