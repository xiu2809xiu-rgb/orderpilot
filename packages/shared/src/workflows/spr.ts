import { z } from "zod";
import { decimalStringSchema } from "../money.js";
import { recordRefSchema } from "../record-number.js";
import { roleSchema } from "../roles.js";
import { approvalUserSetupSchema } from "../governance/approval.js";
import { paymentTypeSchema } from "../governance/payment.js";
import { mockRecordedSchema, orderNoSchema } from "./common.js";

export const sprNumberSchema = z
  .string()
  .regex(/^SPR-\d{8}-\d{4,}$/, "Use a number like SPR-20261102-0001");

export const sprParamsSchema = z.object({ recordNo: sprNumberSchema });

/**
 * Where a field's value came from. A suggestion is a value the system worked
 * out for the person to approve: it is never final until they do.
 */
export const FIELD_ORIGINS = ["suggested", "default", "person"] as const;

export const sprFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string(),
  origin: z.enum(FIELD_ORIGINS),
  required: z.boolean(),
});
export type SprField = z.infer<typeof sprFieldSchema>;

/**
 * The stock figures a pre-fill is worked out from. Available stock is Business Central's
 * Inventory, minus Qty. on Sales Order, plus Qty. on Purch. Order.
 */
export const sprBasisSchema = z.object({
  ordered: decimalStringSchema,
  inventory: decimalStringSchema,
  qtyOnSalesOrder: decimalStringSchema,
  qtyOnPurchOrder: decimalStringSchema,
  availableStock: decimalStringSchema,
  shortfall: decimalStringSchema,
  /** Units sold a month, averaged over the last three months (Spectra, 5 Nov). */
  runRate3m: decimalStringSchema,
  /** Inventory over the run rate, in months; null when nothing sold. */
  monthsOfCover: decimalStringSchema.nullable(),
});
export type SprBasis = z.infer<typeof sprBasisSchema>;

export const SPR_DECISIONS = ["approved", "rejected"] as const;

export const sprDetailSchema = z.object({
  ref: recordRefSchema,
  orderNo: orderNoSchema.nullable(),
  requestedBy: z.object({ name: z.string().min(1), role: roleSchema }),
  requestedAt: z.iso.datetime(),
  vendor: z.object({ no: z.string().min(1), name: z.string().min(1) }),
  item: z.object({ no: z.string().min(1), description: z.string().min(1) }),
  quantity: decimalStringSchema,
  unitCost: decimalStringSchema,
  /** Quantity times unit cost: what the approver's purchase limit is set against. */
  amount: decimalStringSchema,
  currencyCode: z.string().length(3),
  basis: sprBasisSchema,
  fields: z.array(sprFieldSchema),
  /** The approver in Business Central's Approval User Setup shape, from area 4's policy. */
  approver: z.object({
    displayName: z.string().min(1),
    setup: approvalUserSetupSchema,
  }),
  substituteName: z.string().min(1).nullable(),
  /** The name of the person behind `approver.setup.approverId`, who is told when the approver does not act. */
  escalatesToName: z.string().min(1).nullable(),
  /** Who it went to, when it was above someone's limit. It still waits for a decision. */
  passedTo: z
    .object({
      name: z.string().min(1),
      byName: z.string().min(1),
      at: z.iso.datetime(),
      /** What the person who passed it on would have decided, and why. Nothing was decided. */
      askedOutcome: z.enum(SPR_DECISIONS),
      comment: z.string(),
      /** True when the person reading is who it waits for. */
      youDecide: z.boolean(),
    })
    .nullable()
    .optional(),
  /** False for a sample the workflow does not run, which nobody can decide. */
  decidable: z.boolean().optional(),
  /** Null until someone decides. */
  decision: z
    .object({
      outcome: z.enum(SPR_DECISIONS),
      by: z.string().min(1),
      comment: z.string(),
      at: z.iso.datetime(),
    })
    .nullable(),
});
export type SprDetail = z.infer<typeof sprDetailSchema>;

export const sprDecisionInputSchema = z.object({
  comment: z.string().trim().min(1, "Say why").max(500),
});
export type SprDecisionInput = z.infer<typeof sprDecisionInputSchema>;

export const sprDecisionResultSchema = mockRecordedSchema.extend({
  recordNo: sprNumberSchema,
  outcome: z.enum(SPR_DECISIONS),
  /** The comment as it was understood, so the screen can show it was heard. */
  comment: z.string(),
  /** Set when it was above the person's limit: nothing was decided, and it went to this person. */
  passedToName: z.string().min(1).optional(),
});
export type SprDecisionResult = z.infer<typeof sprDecisionResultSchema>;

/** What an Undo of a decision answers: the SPR is waiting for a decision again. */
export const sprDecisionUndoResultSchema = mockRecordedSchema.extend({
  recordNo: sprNumberSchema,
});
export type SprDecisionUndoResult = z.infer<typeof sprDecisionUndoResultSchema>;

export const paymentResultSchema = mockRecordedSchema.extend({
  orderNo: orderNoSchema,
  /** The confirmation's id, which the Undo route takes. */
  paymentId: z.uuid(),
  paymentType: paymentTypeSchema,
});
export type PaymentResult = z.infer<typeof paymentResultSchema>;

export const paymentUndoParamsSchema = z.object({
  orderNo: orderNoSchema,
  paymentId: z.uuid(),
});

export const paymentUndoResultSchema = mockRecordedSchema.extend({
  orderNo: orderNoSchema,
  paymentId: z.uuid(),
});
export type PaymentUndoResult = z.infer<typeof paymentUndoResultSchema>;
