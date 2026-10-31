import { z } from "zod";
import type { Role } from "./roles.js";

/**
 * The permissions the platform checks so far. Area 4 owns the role-permission
 * matrix (which role holds which) and adds the area permissions as stories land.
 * This list is the names only: the server decides, the web app never does.
 */
export const PERMISSIONS = [
  "users.read",
  "users.manage",
  "roles.manage",
  "settings.manage",
  "audit.read",
  "aiUsage.read",
  "documents.read",
  "documents.upload",
  "orders.read",
  "workflows.read",
  "spr.read",
  "spr.decide",
  "payments.confirm",
  "workflows.inboxes.any",
] as const;

export const permissionSchema = z.enum(PERMISSIONS);
export type Permission = z.infer<typeof permissionSchema>;

/**
 * The default role-permission matrix: which role holds which permission. The
 * API seeds it into the RolePermission table (P-10) and the web app's tests use
 * the same table, so the two never disagree. Area 4 owns the live matrix and
 * edits it in the database; this is only where a fresh database starts.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SYSTEM_ADMIN: [
    "users.read",
    "users.manage",
    "roles.manage",
    "settings.manage",
    "audit.read",
    "aiUsage.read",
  ],
  PRODUCT_MANAGER: [
    "orders.read",
    "documents.read",
    "workflows.read",
    "spr.read",
  ],
  APPROVER: [
    "orders.read",
    "documents.read",
    "workflows.read",
    "spr.read",
    "spr.decide",
  ],
  SUPPORT: [
    "orders.read",
    "documents.read",
    "documents.upload",
    "workflows.read",
  ],
  WAREHOUSE: ["orders.read", "documents.read", "workflows.read"],
  FINANCE: [
    "orders.read",
    "documents.read",
    "workflows.read",
    "payments.confirm",
  ],
  LOGISTICS: ["orders.read", "documents.read", "workflows.read"],
  MANAGEMENT: [
    "orders.read",
    "documents.read",
    "aiUsage.read",
    "workflows.read",
    "spr.read",
    "workflows.inboxes.any",
  ],
  AUDITOR: [
    "orders.read",
    "audit.read",
    "aiUsage.read",
    "workflows.read",
    "spr.read",
    "workflows.inboxes.any",
  ],
};
