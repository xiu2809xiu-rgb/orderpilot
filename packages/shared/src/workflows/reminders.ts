import { z } from "zod";
import { pageQuerySchema } from "../envelope.js";
import { roleSchema } from "../roles.js";
import { orderNoSchema } from "./common.js";

export const REMINDER_KINDS = [
  "TASK_DUE",
  "PAYMENT_DUE",
  "SHIPPING_DOCUMENT_MISSING",
  "IMPORT_PERMIT_MISSING",
] as const;

/** Where a reminder is in its life: waiting to be sent, sent, or passed up. */
export const REMINDER_STAGES = ["scheduled", "sent", "escalated"] as const;

export const workflowReminderSchema = z.object({
  id: z.uuid(),
  kind: z.enum(REMINDER_KINDS),
  stage: z.enum(REMINDER_STAGES),
  orderNo: orderNoSchema,
  message: z.string().min(1),
  toRole: roleSchema,
  /** When the thing being waited for is due. */
  dueAt: z.iso.datetime(),
  /** When the reminder goes (or went) out. */
  remindAt: z.iso.datetime(),
  /** When it passes to the next person if nobody acts; null once escalated. */
  escalatesAt: z.iso.datetime().nullable(),
  escalatedTo: roleSchema.nullable(),
});
export type WorkflowReminder = z.infer<typeof workflowReminderSchema>;

export const remindersQuerySchema = pageQuerySchema;
export type RemindersQuery = z.infer<typeof remindersQuerySchema>;
