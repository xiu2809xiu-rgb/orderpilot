import { z } from "zod";
import { decimalStringSchema } from "../money.js";
import { documentTypeSchema } from "../order.js";
import { roleSchema } from "../roles.js";
import { orderNoSchema } from "./common.js";
import { paymentRecordSchema } from "./payment.js";

/**
 * A step on the way an order takes. `state` says where the order is on that
 * step for display; it is not the order's status, which only Azri's state
 * machine will hold.
 */
export const STEP_STATES = ["done", "current", "upcoming", "skipped"] as const;

export const orderStepSchema = z.object({
  /** Stable key, such as `payment-confirmed`. The screen's text is keyed by it. */
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  ownerRole: roleSchema,
  state: z.enum(STEP_STATES),
  /** A step that only some orders need, such as SPR approval. */
  optional: z.boolean(),
  dueAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  overdue: z.boolean(),
});
export type OrderStep = z.infer<typeof orderStepSchema>;

export const TIMELINE_KINDS = [
  "order.received",
  "step.completed",
  "task.created",
  "reminder.sent",
  "payment.confirmed",
] as const;

export const orderTimelineEventSchema = z.object({
  id: z.uuid(),
  at: z.iso.datetime(),
  kind: z.enum(TIMELINE_KINDS),
  actor: z.object({
    kind: z.enum(["user", "system"]),
    name: z.string().min(1),
  }),
  summary: z.string().min(1),
});
export type OrderTimelineEvent = z.infer<typeof orderTimelineEventSchema>;

/** What Finance needs beside the steps: the prepayment asked for and what was confirmed. */
export const orderPaymentSchema = z.object({
  prepaymentPercent: decimalStringSchema,
  amountDue: decimalStringSchema.nullable(),
  confirmations: z.array(paymentRecordSchema),
});
export type OrderPayment = z.infer<typeof orderPaymentSchema>;

/** Where one of the order's documents stands: received and confirmed, received and waiting for a person, or still expected. */
export const ORDER_DOCUMENT_STATUSES = [
  "confirmed",
  "to-confirm",
  "expected",
] as const;

/** A document on the order, so the order page can list what came in and what is still awaited. */
export const orderFlowDocumentSchema = z.object({
  id: z.string().min(1),
  type: documentTypeSchema,
  /** The number printed on it; null while it is only expected. */
  number: z.string().min(1).nullable(),
  status: z.enum(ORDER_DOCUMENT_STATUSES),
  receivedAt: z.iso.datetime().nullable(),
  /** When an expected document is due. */
  dueDate: z.iso.date().nullable(),
});
export type OrderFlowDocument = z.infer<typeof orderFlowDocumentSchema>;

export const orderFlowSchema = z.object({
  order: z.object({
    no: orderNoSchema,
    sellToCustomerNo: z.string().min(1),
    customerName: z.string().min(1),
    /** The customer's PO number. */
    externalDocumentNo: z.string().min(1),
    orderDate: z.iso.date(),
  }),
  steps: z.array(orderStepSchema),
  timeline: z.array(orderTimelineEventSchema),
  payment: orderPaymentSchema,
  documents: z.array(orderFlowDocumentSchema),
});
export type OrderFlow = z.infer<typeof orderFlowSchema>;

export const orderParamsSchema = z.object({ orderNo: orderNoSchema });
