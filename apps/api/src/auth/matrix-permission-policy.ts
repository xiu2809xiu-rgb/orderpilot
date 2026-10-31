import { Inject, Injectable } from "@nestjs/common";
import { NEVER_FOR_SYSTEM_ADMIN } from "@orderpilot/shared";
import { RolePermissionRepository } from "./role-permission.repository.js";
import {
  PermissionPolicy,
  type AccessDecision,
  type AccessRequest,
} from "./permission-policy.js";

/**
 * The default policy: a role holds a permission or it does not, except the
 * cells the system admin can never hold.
 */
@Injectable()
export class MatrixPermissionPolicy extends PermissionPolicy {
  constructor(
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
  ) {
    super();
  }

  async decide(request: AccessRequest): Promise<AccessDecision> {
    // The matrix edit path refuses these cells, but a row put in the table by
    // any other route (a reseed, a script) must not let the admin approve or pay.
    if (
      request.user.role === "SYSTEM_ADMIN" &&
      (NEVER_FOR_SYSTEM_ADMIN as readonly string[]).includes(request.permission)
    ) {
      return {
        allowed: false,
        reason: "the system admin never holds this permission",
      };
    }
    const allowed = await this.matrix.has(
      request.user.role,
      request.permission,
    );
    return allowed
      ? { allowed }
      : { allowed, reason: "the role does not hold the permission" };
  }
}
