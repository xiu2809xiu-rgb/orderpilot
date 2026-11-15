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
  // P-49: making an order and editing a draft. The system admin never holds them.
  "orders.create",
  "orders.edit",
  // Area 3 (D-1): the tracker and an order's timeline, the exceptions queue and the KPIs.
  "tracker.read",
  "exceptions.read",
  "insights.read",
  // Acting on money and approvals. The system admin role never holds these
  // (see governance/matrix.ts). The default matrix below grants approvals.decide
  // to the approver and to Management, which decides what is above an
  // approver's limit and what escalates while the approver is away (ADR 0041),
  // and payments.confirm to finance. payments.post stays ungranted: no route
  // uses it yet, and area 4 decides it.
  "approvals.decide",
  "payments.confirm",
  "payments.post",
  // Area 2 (C-1): the workflow screens, SPR reads, and other people's approver inboxes.
  "workflows.read",
  "spr.read",
  "workflows.inboxes.any",
  // Marking a task in the caller's own inbox as done. The system admin never
  // holds it (see governance/matrix.ts).
  "tasks.complete",
  // Area 4 (F-8): who sees the masking sample's customer note. The sample rule
  // reads its roles from the matrix, so this row shows or hides the note.
  "masking.customerNote",
  // Area 4 (#252): the coordinator routes each SPR to the approver group and
  // hands it back. Support holds it, and never decides an SPR (ADR 0055).
  "spr.route",
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
    "orders.create",
    "orders.edit",
    "documents.read",
    "tracker.read",
    "insights.read",
    "workflows.read",
    "spr.read",
    "tasks.complete",
    "masking.customerNote",
  ],
  APPROVER: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "workflows.read",
    "spr.read",
    "approvals.decide",
    "tasks.complete",
    "masking.customerNote",
  ],
  SUPPORT: [
    "orders.read",
    "orders.create",
    "orders.edit",
    "documents.read",
    "documents.upload",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
    "tasks.complete",
    "masking.customerNote",
    // The coordinator: Support routes each SPR, so it reads them (#252).
    "spr.read",
    "spr.route",
  ],
  WAREHOUSE: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
    "tasks.complete",
  ],
  FINANCE: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
    "payments.confirm",
    "tasks.complete",
  ],
  LOGISTICS: [
    "orders.read",
    "documents.read",
    "tracker.read",
    "exceptions.read",
    "workflows.read",
    "tasks.complete",
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
    "approvals.decide",
    "workflows.inboxes.any",
    "masking.customerNote",
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
    "masking.customerNote",
  ],
};
