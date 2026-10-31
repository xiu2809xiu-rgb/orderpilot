import { z } from "zod";
import { pageQuerySchema } from "../envelope.js";
import { decimalStringSchema } from "../money.js";
import { recordRefSchema } from "../record-number.js";
import { roleSchema } from "../roles.js";
import { orderNoSchema } from "./common.js";

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

export const TASK_PRIORITIES = ["high", "normal", "low"] as const;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

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
  // What a person needs to pick the task up. The mock read model fills these;
  // they are optional so a read model that cannot say them yet still parses.
  customerNo: z.string().min(1).optional(),
  customerName: z.string().min(1).optional(),
  /** The order's value, in `currencyCode`. */
  amount: decimalStringSchema.optional(),
  currencyCode: z.string().length(3).optional(),
  priority: taskPrioritySchema.optional(),
  /** The person in the role who holds the task. */
  assigneeName: z.string().min(1).optional(),
});
export type WorkflowTask = z.infer<typeof workflowTaskSchema>;

export const tasksQuerySchema = pageQuerySchema.extend({
  /** "true" keeps only overdue tasks. */
  overdue: z.enum(["true", "false"]).optional(),
  kind: taskKindSchema.optional(),
  priority: taskPrioritySchema.optional(),
});
export type TasksQuery = z.infer<typeof tasksQuerySchema>;
