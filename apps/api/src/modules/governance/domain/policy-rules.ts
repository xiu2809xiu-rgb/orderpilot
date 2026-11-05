import { NEVER_FOR_SYSTEM_ADMIN } from "@orderpilot/shared";
import type { PolicyContext, PolicyRule } from "./authorisation-policy.js";

/**
 * The system admin configures the platform and never approves, posts or pays.
 * The matrix edit path refuses those cells, but a row put in the table by any
 * other route (a reseed, a script) must change nothing, so it is checked here
 * too, at decision time.
 */
export class SystemAdminRule implements PolicyRule {
  readonly name = "system-admin";

  refusal({ actor, permission }: PolicyContext): string | null {
    const never: readonly string[] = NEVER_FOR_SYSTEM_ADMIN;
    return actor.role === "SYSTEM_ADMIN" && never.includes(permission)
      ? "the system admin never holds this permission"
      : null;
  }
}

/** The role must hold the permission in the role-permission matrix. */
export class PermissionRule implements PolicyRule {
  readonly name = "permission";

  refusal({ roleHoldsPermission }: PolicyContext): string | null {
    return roleHoldsPermission ? null : "the role does not hold the permission";
  }
}
