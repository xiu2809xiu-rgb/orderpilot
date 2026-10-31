import { Inject, Injectable } from "@nestjs/common";
import {
  LOCKED_CELLS,
  PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  type CopyRoleBody,
  type DataScope,
  type Matrix,
  type Permission,
  type Role,
  type RoleAccess,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { Database } from "../../database/database.js";
import type { RequestInfo } from "../../users/users.service.js";
import { DataScopeRepository } from "./data-scope.repository.js";
import {
  assertCanGrant,
  assertCanRevoke,
  planCopy,
} from "./domain/matrix-rules.js";

/**
 * Reads and edits the role-permission matrix. Every change is made in one
 * transaction with its audit event, so a change without a trail cannot exist.
 * The permissions guard reads the same table on each request, so a change
 * takes effect at once.
 */
@Injectable()
export class MatrixService {
  constructor(
    @Inject(RolePermissionRepository)
    private readonly permissions: RolePermissionRepository,
    @Inject(DataScopeRepository) private readonly scopes: DataScopeRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(Database) private readonly database: Database,
  ) {}

  async matrix(): Promise<Matrix> {
    const [pairs, scopes] = await Promise.all([
      this.permissions.all(),
      this.scopes.all(),
    ]);
    const roles = ROLES.map((role): RoleAccess => ({
      role,
      permissions: PERMISSIONS.filter((permission) =>
        pairs.some((p) => p.role === role && p.permission === permission),
      ),
      dataScope: scopes[role],
    }));
    return { permissions: [...PERMISSIONS], roles, locked: [...LOCKED_CELLS] };
  }

  private async access(role: Role): Promise<RoleAccess> {
    const [held, dataScope] = await Promise.all([
      this.permissions.permissionsOf(role),
      this.scopes.get(role),
    ]);
    return { role, permissions: held, dataScope };
  }

  setPermission(
    role: Role,
    permission: Permission,
    granted: boolean,
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<RoleAccess> {
    return this.database.transaction(async () => {
      if (granted) assertCanGrant(role, permission);
      else assertCanRevoke(role, permission);
      const already = await this.permissions.has(role, permission);
      if (already !== granted) {
        if (granted) await this.permissions.grant(role, permission);
        else await this.permissions.revoke(role, permission);
        await this.audit.record({
          actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
          action: granted
            ? "governance.permission.granted"
            : "governance.permission.revoked",
          entityType: "RolePermission",
          entityId: `${role}:${permission}`,
          summary: `${actor.user.displayName} ${granted ? "granted" : "revoked"} ${permission} ${granted ? "to" : "from"} ${ROLE_LABELS[role]}`,
          changes: {
            role,
            permission,
            granted: { from: already, to: granted },
          },
          ip: info.ip,
          traceId: info.traceId,
        });
      }
      return this.access(role);
    });
  }

  setDataScope(
    role: Role,
    dataScope: DataScope,
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<RoleAccess> {
    return this.database.transaction(async () => {
      const before = await this.scopes.get(role);
      if (before !== dataScope) {
        await this.scopes.set(role, dataScope);
        await this.audit.record({
          actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
          action: "governance.data-scope.changed",
          entityType: "Role",
          entityId: role,
          summary: `${actor.user.displayName} set the data scope of ${ROLE_LABELS[role]} to ${dataScope}`,
          changes: { role, dataScope: { from: before, to: dataScope } },
          ip: info.ip,
          traceId: info.traceId,
        });
      }
      return this.access(role);
    });
  }

  /** Makes `toRole` hold what `fromRole` holds, with the same data scope. */
  copyRole(
    body: CopyRoleBody,
    actor: AuthContext,
    info: RequestInfo,
  ): Promise<RoleAccess> {
    return this.database.transaction(async () => {
      const { fromRole, toRole } = body;
      const [source, target, scope, before] = await Promise.all([
        this.permissions.permissionsOf(fromRole),
        this.permissions.permissionsOf(toRole),
        this.scopes.get(fromRole),
        this.scopes.get(toRole),
      ]);
      const plan = planCopy(fromRole, toRole, source, target);
      for (const permission of plan.grant) {
        await this.permissions.grant(toRole, permission);
      }
      for (const permission of plan.revoke) {
        await this.permissions.revoke(toRole, permission);
      }
      await this.scopes.set(toRole, scope);
      await this.audit.record({
        actor: { kind: "user", userId: actor.user.id, role: actor.user.role },
        action: "governance.role.copied",
        entityType: "Role",
        entityId: toRole,
        summary: `${actor.user.displayName} copied the access of ${ROLE_LABELS[fromRole]} to ${ROLE_LABELS[toRole]}`,
        changes: {
          fromRole,
          toRole,
          granted: plan.grant,
          revoked: plan.revoke,
          dataScope: { from: before, to: scope },
        },
        ip: info.ip,
        traceId: info.traceId,
      });
      return this.access(toRole);
    });
  }
}
