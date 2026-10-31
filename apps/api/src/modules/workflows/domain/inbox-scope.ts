import { INBOX_ROLES, type InboxRole, type Role } from "@orderpilot/shared";
import { DomainError } from "../../../common/domain-error.js";

/**
 * Whose inbox "my tasks" is. A role with an inbox sees its own. Whether a
 * caller may open someone else's is an access rule, not decided here: those
 * routes sit behind `workflows.inboxes.any`, which the PermissionPolicy
 * answers (area 4 owns the answer). This keeps no list of roles that
 * may look at everything.
 */
export const InboxScope = {
  own(caller: Role): InboxRole {
    const own = INBOX_ROLES.find((role) => role === caller);
    if (!own) {
      throw new DomainError(
        "FORBIDDEN",
        "Your role has no task inbox. Open one from the inbox list.",
      );
    }
    return own;
  },
};
