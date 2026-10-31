import { z } from "zod";
import { pageQuerySchema } from "../envelope.js";
import { recordRefSchema } from "../record-number.js";
import { roleSchema } from "../roles.js";
import { inboxRoleSchema, orderNoSchema } from "./common.js";

/**
 * The kinds of task a step can give a role. A starter list for the sales flow:
 * Azri's state machine decides which step creates which task, and adds kinds
 * here. The database holds the kind as plain text, so a new kind needs no
 * migration.
 */
export const TASK_KINDS = [
  "REVIEW_FIELDS",
  "RAISE_SPR",
  "APPROVE_SPR",
  "SEND_PI",
  "CONFIRM_PAYMENT",
  "PACK_ORDER",
  "ADD_SHIPPING_DOCUMENTS",
] as const;
export const taskKindSchema = z.enum(TASK_KINDS);
export type TaskKind = z.infer<typeof taskKindSchema>;

export const TASK_STATUSES = ["OPEN", "DONE", "CANCELLED"] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** One task in a role's inbox. A task's status is not the order's status. */
export const workflowTaskSchema = z.object({
  id: z.uuid(),
  kind: taskKindSchema,
  title: z.string().min(1),
  assigneeRole: roleSchema,
  /** Navision's sales order number, when the task belongs to an order. */
  orderNo: orderNoSchema.nullable(),
  /** OrderPilot's own number beside Navision's, when the task is about a record such as an SPR. */
  ref: recordRefSchema.nullable(),
  status: taskStatusSchema,
  createdAt: z.iso.datetime(),
  dueAt: z.iso.datetime(),
  overdue: z.boolean(),
});
export type WorkflowTask = z.infer<typeof workflowTaskSchema>;

export const tasksQuerySchema = pageQuerySchema.extend({
  /** Defaults to the caller's own role. Roles without an inbox may name one. */
  role: inboxRoleSchema.optional(),
  /** "true" keeps only overdue tasks. */
  overdue: z.enum(["true", "false"]).optional(),
});
export type TasksQuery = z.infer<typeof tasksQuerySchema>;
