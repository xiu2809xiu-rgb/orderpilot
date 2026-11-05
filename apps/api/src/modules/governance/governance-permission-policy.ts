import { Inject, Injectable } from "@nestjs/common";
import {
  PermissionPolicy,
  type AccessDecision,
  type AccessRequest,
} from "../../auth/permission-policy.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { ROUTE_POLICY } from "./domain/policies.js";

/**
 * Area 4's policy behind the PermissionPolicy token, so the permissions guard
 * asks the same rules as every action does. A route check knows only the
 * permission; the rules that need an amount or a requester run when the area
 * calls AuthorisationService.enforce before it acts.
 */
@Injectable()
export class GovernancePermissionPolicy extends PermissionPolicy {
  constructor(
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
  ) {
    super();
  }

  async decide({ user, permission }: AccessRequest): Promise<AccessDecision> {
    const decision = ROUTE_POLICY.decide({
      actor: { userId: user.id, role: user.role },
      permission,
      roleHoldsPermission: await this.matrix.has(user.role, permission),
    });
    return decision.outcome === "allowed"
      ? { allowed: true }
      : { allowed: false, reason: decision.reason };
  }
}
