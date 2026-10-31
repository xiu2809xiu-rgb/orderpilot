import { ConflictError } from "../../common/domain-error.js";

/** An administrator may not lock themselves out: someone else has to do it. */
export function assertNotSelf(actorId: string, targetId: string): void {
  if (actorId === targetId) {
    throw new ConflictError("You cannot disable your own account.");
  }
}
