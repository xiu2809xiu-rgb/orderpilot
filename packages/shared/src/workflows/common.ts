import { z } from "zod";
import type { Role } from "../roles.js";

/**
 * The roles that have a task inbox. The others (system admin, management,
 * auditor) have no tasks of their own; they may look at any inbox.
 */
export const INBOX_ROLES = [
  "PRODUCT_MANAGER",
  "APPROVER",
  "SUPPORT",
  "WAREHOUSE",
  "FINANCE",
  "LOGISTICS",
] as const satisfies readonly Role[];
export const inboxRoleSchema = z.enum(INBOX_ROLES);
export type InboxRole = z.infer<typeof inboxRoleSchema>;

/** Navision's sales order number, as the sample data writes it: `SO-0003`. */
export const orderNoSchema = z.string().regex(/^[A-Za-z0-9-]{1,30}$/);

/**
 * What a command answers while the base has no state machine behind it: it was
 * understood, permission-checked and validated, and it changed nothing.
 */
export const notAppliedSchema = z.object({
  applied: z.literal(false),
  message: z.string(),
});
export const NOT_APPLIED_MESSAGE =
  "Nothing was changed. The workflow engine is not built yet, so this was only checked.";

/** The path of the routes that open one role's inbox: `/workflows/inboxes/WAREHOUSE/tasks`. */
export const inboxParamsSchema = z.object({ role: inboxRoleSchema });
