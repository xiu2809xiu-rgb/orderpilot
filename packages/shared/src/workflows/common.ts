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

/**
 * What a command answers while a mock overlay keeps its result: the screens
 * move on and the action can be undone, but only until the API restarts. The
 * order's own status does not change. Area 2's state machine replaces this.
 */
export const mockRecordedSchema = z.object({
  applied: z.literal(true),
  message: z.string(),
});
export const MOCK_RECORDED_MESSAGE =
  "Recorded on mock data. The order's status has not changed, and a restart of the API forgets this.";

/** A task in an inbox: the path of its Complete and Undo routes. */
export const taskParamsSchema = z.object({ taskId: z.uuid() });

/** The path of the routes that open one role's inbox: `/workflows/inboxes/WAREHOUSE/tasks`. */
export const inboxParamsSchema = z.object({ role: inboxRoleSchema });
