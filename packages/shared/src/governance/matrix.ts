import { z } from "zod";
import { permissionSchema, type Permission } from "../permissions.js";
import { roleSchema, type Role } from "../roles.js";

/**
 * Which records a role may see, besides which actions it may take. Enforcing
 * it (filtering a list to a Product Manager's brands) is area 4's job; the
 * base stores it and shows it on the matrix.
 *  - all: every record.
 *  - brands: only the brands assigned to the user (if Spectra confirms brand
 *    ownership, Q-17).
 *  - own: only records the user raised.
 */
export const DATA_SCOPES = ["all", "brands", "own"] as const;
export const dataScopeSchema = z.enum(DATA_SCOPES);
export type DataScope = z.infer<typeof dataScopeSchema>;

/** Where a fresh database starts. A role with no stored scope reads as this. */
export const DEFAULT_DATA_SCOPES: Record<Role, DataScope> = {
  SYSTEM_ADMIN: "all",
  PRODUCT_MANAGER: "brands",
  APPROVER: "all",
  SUPPORT: "all",
  WAREHOUSE: "all",
  FINANCE: "all",
  LOGISTICS: "all",
  MANAGEMENT: "all",
  AUDITOR: "all",
};

/** The system admin configures the platform and never approves, posts or pays. */
export const NEVER_FOR_SYSTEM_ADMIN = [
  "approvals.decide",
  "payments.confirm",
  "payments.post",
] as const satisfies readonly Permission[];

/** Kept on the system admin role, so the matrix can always be edited. */
export const ALWAYS_FOR_SYSTEM_ADMIN = [
  "roles.manage",
] as const satisfies readonly Permission[];

/** A cell of the matrix that cannot be changed, and why. */
export const lockedCellSchema = z.object({
  role: roleSchema,
  permission: permissionSchema,
  /** never: cannot be granted. always: cannot be revoked. */
  kind: z.enum(["never", "always"]),
  reason: z.string().min(1),
});
export type LockedCell = z.infer<typeof lockedCellSchema>;

export const LOCKED_CELLS: readonly LockedCell[] = [
  ...NEVER_FOR_SYSTEM_ADMIN.map((permission): LockedCell => ({
    role: "SYSTEM_ADMIN",
    permission,
    kind: "never",
    reason:
      "The system admin configures the platform and never approves, posts or pays.",
  })),
  ...ALWAYS_FOR_SYSTEM_ADMIN.map((permission): LockedCell => ({
    role: "SYSTEM_ADMIN",
    permission,
    kind: "always",
    reason: "Without it nobody could edit the matrix again.",
  })),
];

export const roleAccessSchema = z.object({
  role: roleSchema,
  permissions: z.array(permissionSchema),
  dataScope: dataScopeSchema,
});
export type RoleAccess = z.infer<typeof roleAccessSchema>;

export const matrixSchema = z.object({
  /** Every permission the platform checks, in display order. */
  permissions: z.array(permissionSchema),
  roles: z.array(roleAccessSchema),
  locked: z.array(lockedCellSchema),
});
export type Matrix = z.infer<typeof matrixSchema>;

export const matrixPermissionParamsSchema = z.object({
  role: roleSchema,
  permission: permissionSchema,
});
export const matrixRoleParamsSchema = z.object({ role: roleSchema });

export const setPermissionBodySchema = z.object({ granted: z.boolean() });
export const setDataScopeBodySchema = z.object({ dataScope: dataScopeSchema });
export const copyRoleBodySchema = z.object({
  fromRole: roleSchema,
  toRole: roleSchema,
});
export type CopyRoleBody = z.infer<typeof copyRoleBodySchema>;
