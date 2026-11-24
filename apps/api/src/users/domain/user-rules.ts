import { ConflictError } from "../../common/domain-error.js";

/** Whether a person is acting on their own account. */
export function isSelf(actorId: string, targetId: string): boolean {
  return actorId === targetId;
}

/** An administrator may not lock themselves out: someone else has to do it. */
export function assertNotSelf(actorId: string, targetId: string): void {
  if (isSelf(actorId, targetId)) {
    throw new ConflictError("You cannot disable your own account.");
  }
}
