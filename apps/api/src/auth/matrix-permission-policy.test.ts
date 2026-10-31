import type { Permission, Role } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import type { AuthUser } from "./auth-context.js";
import { MatrixPermissionPolicy } from "./matrix-permission-policy.js";
import type { RolePermissionRepository } from "./role-permission.repository.js";

/** A table that holds every pair, as if a row came in by another route. */
const everything = {
  has: () => Promise.resolve(true),
} as unknown as RolePermissionRepository;

const ask = (role: Role, permission: Permission) =>
  new MatrixPermissionPolicy(everything).decide({
    user: { role } as AuthUser,
    permission,
    method: "POST",
    path: "/",
    params: {},
  });

describe("matrix permission policy", () => {
  it("denies the system admin the three money cells even if the table holds them", async () => {
    for (const permission of [
      "approvals.decide",
      "payments.confirm",
      "payments.post",
    ] as const) {
      const decision = await ask("SYSTEM_ADMIN", permission);
      expect(decision.allowed, permission).toBe(false);
      expect(decision.reason).toBeTruthy();
    }
  });

  it("follows the table for every other pair", async () => {
    expect((await ask("SYSTEM_ADMIN", "roles.manage")).allowed).toBe(true);
    expect((await ask("FINANCE", "payments.post")).allowed).toBe(true);
  });
});
