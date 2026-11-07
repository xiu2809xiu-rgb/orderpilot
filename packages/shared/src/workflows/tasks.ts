import { z } from "zod";
import { pageQuerySchema } from "../envelope.js";
import { paymentTypeSchema } from "../governance/payment.js";
import { decimalStringSchema } from "../money.js";
import { recordRefSchema } from "../record-number.js";
import { roleSchema } from "../roles.js";
import { mockRecordedSchema, orderNoSchema } from "./common.js";

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
  "RECOUNT_CARTONS",
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
  /** What the task is about, in `currencyCode`: an SPR's own amount on an SPR task, else the order's value. */
  amount: decimalStringSchema.optional(),
  currencyCode: z.string().length(3).optional(),
  priority: taskPrioritySchema.optional(),
  /** The person in the role who holds the task. */
  assigneeName: z.string().min(1).optional(),
  /** On a payment task: the payment it waits for, so one click can confirm it. */
  expectedPayment: z
    .object({
      paymentType: paymentTypeSchema,
      amount: decimalStringSchema,
      currencyCode: z.string().length(3),
    })
    .optional(),
});
export type WorkflowTask = z.infer<typeof workflowTaskSchema>;

/** Why an SPR left its approver's inbox for someone else. */
export const HANDOVER_REASONS = [
  "substitute",
  "escalated",
  "passed-on",
  "named",
] as const;
export type HandoverReason = (typeof HANDOVER_REASONS)[number];

/** A task the approval chain has handed to one person, and why it is theirs. */
export const handedTaskSchema = workflowTaskSchema.extend({
  handedOver: z.object({
    reason: z.enum(HANDOVER_REASONS),
    /** Who it came from: the person away, the person who passed it on, or the requester. */
    fromName: z.string().min(1),
    /** False when area 4's policy would refuse this person outright, so the screen can say so. */
    canAct: z.boolean(),
  }),
});
export type HandedTask = z.infer<typeof handedTaskSchema>;

export const tasksQuerySchema = pageQuerySchema.extend({
  /** "true" keeps only overdue tasks. */
  overdue: z.enum(["true", "false"]).optional(),
  kind: taskKindSchema.optional(),
  priority: taskPrioritySchema.optional(),
});
export type TasksQuery = z.infer<typeof tasksQuerySchema>;

/**
 * The kinds a person simply marks as done. Reviewing fields has its own screen,
 * and an SPR or a payment has its own route and its own permission, so the
 * general Complete route must never stand in for those.
 */
export const COMPLETABLE_TASK_KINDS = [
  "RAISE_SPR",
  "SEND_PI",
  "PACK_ORDER",
  "RECOUNT_CARTONS",
  "ADD_SHIPPING_DOCUMENTS",
] as const satisfies readonly TaskKind[];

export const taskActionResultSchema = mockRecordedSchema.extend({
  taskId: z.uuid(),
  /** "OPEN" after an Undo, "DONE" after a completion. */
  status: taskStatusSchema,
});
export type TaskActionResult = z.infer<typeof taskActionResultSchema>;

/**
 * The business rules that stay configuration until Spectra confirms them, with
 * today's draft value. `screen` is the web route where the rule can be read,
 * or null when no screen holds it yet.
 */
export const OPEN_RULE_IDS = [
  "sprTrigger",
  "piSequence",
  "approversAndLimits",
  "delegation",
] as const;
export const openRuleSchema = z.object({
  id: z.enum(OPEN_RULE_IDS),
  value: z.string().min(1),
  screen: z.string().min(1).nullable(),
});
export type OpenRule = z.infer<typeof openRuleSchema>;
