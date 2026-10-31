import { Inject, Injectable } from "@nestjs/common";
import { RolePermissionRepository } from "./role-permission.repository.js";
import {
  PermissionPolicy,
  type AccessDecision,
  type AccessRequest,
} from "./permission-policy.js";

/** The default policy: a role holds a permission or it does not. */
@Injectable()
export class MatrixPermissionPolicy extends PermissionPolicy {
  constructor(
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
  ) {
    super();
  }

  async decide(request: AccessRequest): Promise<AccessDecision> {
    const allowed = await this.matrix.has(
      request.user.role,
      request.permission,
    );
    return allowed
      ? { allowed }
      : { allowed, reason: "the role does not hold the permission" };
  }
}
