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
  "roles.read",
  "roles.manage",
  "settings.manage",
  "audit.read",
  "aiUsage.read",
  "documents.read",
  "documents.upload",
  "orders.read",
  // Area 3 (D-1): the tracker and an order's timeline, the exceptions queue and the KPIs.
  "tracker.read",
  "exceptions.read",
  "insights.read",
  // Acting on money and approvals. The system admin role never holds these
  // (see governance/matrix.ts). The default matrix below grants approvals.decide
  // to the approver and payments.confirm to finance. payments.post stays
  // ungranted: no route uses it yet, and area 4 decides it.
  "approvals.decide",
  "payments.confirm",
  "payments.post",
  // Area 2 (C-1): the workflow screens, SPR reads, and other people's approver inboxes.
  "workflows.read",
  "spr.read",
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
    "roles.read",
    "roles.manage",
    "settings.manage",
    "audit.read",
    "aiUsage.read",
  ],
  PRODUCT_MANAGER: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "insights.read",
    "workflows.read",
    "spr.read",
  ],
  APPROVER: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "workflows.read",
    "spr.read",
    "approvals.decide",
  ],
  SUPPORT: [
    "orders.read",
    "documents.read",
    "documents.upload",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
  ],
  WAREHOUSE: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
  ],
  FINANCE: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
    "payments.confirm",
  ],
  LOGISTICS: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
  ],
  MANAGEMENT: [
    "orders.read",
    "documents.read",
    "aiUsage.read",
    "tracker.read",
    "exceptions.read",
    "insights.read",
    "workflows.read",
    "spr.read",
    "workflows.inboxes.any",
  ],
  AUDITOR: [
    "orders.read",
    "audit.read",
    "aiUsage.read",
    "roles.read",
    "tracker.read",
    "exceptions.read",
    "insights.read",
    "workflows.read",
    "spr.read",
    "workflows.inboxes.any",
  ],
};
