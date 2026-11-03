import {
  DEFAULT_ROLE_PERMISSIONS,
  NEVER_FOR_SYSTEM_ADMIN,
  PERMISSIONS,
  ROLES,
  type Permission,
  type Role,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { AuthUser } from "../../auth/auth-context.js";
import type { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { GovernancePermissionPolicy } from "./governance-permission-policy.js";

/** The role-permission table as a function, so no database is needed. */
const table = (has: (role: Role, permission: Permission) => boolean) =>
  ({
    has: (role: Role, permission: Permission) =>
      Promise.resolve(has(role, permission)),
  }) as unknown as RolePermissionRepository;

const ask = (
  policy: GovernancePermissionPolicy,
  role: Role,
  permission: Permission,
) =>
  policy.decide({
    user: { id: "00000000-0000-4000-8000-000000000001", role } as AuthUser,
    permission,
    method: "POST",
    path: "/",
    params: {},
  });

describe("area 4's policy behind the permissions guard", () => {
  it("allows each role exactly what the default matrix grants it, and refuses the rest", async () => {
    const policy = new GovernancePermissionPolicy(
      table((role, permission) =>
        DEFAULT_ROLE_PERMISSIONS[role].includes(permission),
      ),
    );
    for (const role of ROLES) {
      for (const permission of PERMISSIONS) {
        const decision = await ask(policy, role, permission);
        const granted = DEFAULT_ROLE_PERMISSIONS[role].includes(permission);
        expect(decision.allowed, `${role} ${permission}`).toBe(granted);
        if (!granted) expect(decision.reason).toBeTruthy();
      }
    }
  });

  it("refuses the system admin the right to approve, post or pay, even if the table holds it", async () => {
    const policy = new GovernancePermissionPolicy(table(() => true));
    for (const permission of NEVER_FOR_SYSTEM_ADMIN) {
      const decision = await ask(policy, "SYSTEM_ADMIN", permission);
      expect(decision, permission).toEqual({
        allowed: false,
        reason: "the system admin never holds this permission",
      });
    }
    expect((await ask(policy, "SYSTEM_ADMIN", "roles.manage")).allowed).toBe(
      true,
    );
  });

  it("names the rule's reason when a role does not hold the permission", async () => {
    const policy = new GovernancePermissionPolicy(table(() => false));
    expect(await ask(policy, "WAREHOUSE", "approvals.decide")).toEqual({
      allowed: false,
      reason: "the role does not hold the permission",
    });
  });
});
