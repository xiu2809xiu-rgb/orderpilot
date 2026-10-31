import { z } from "zod";
import { decimalStringSchema } from "../money.js";
import { recordRefSchema } from "../record-number.js";
import { roleSchema } from "../roles.js";
import { approvalUserSetupSchema } from "./approval.js";
import { notAppliedSchema, orderNoSchema } from "./common.js";

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
 * The stock figures a pre-fill is worked out from. Available stock is Navision's
 * Inventory, minus Qty. on Sales Order, plus Qty. on Purch. Order.
 */
export const sprBasisSchema = z.object({
  ordered: decimalStringSchema,
  inventory: decimalStringSchema,
  qtyOnSalesOrder: decimalStringSchema,
  qtyOnPurchOrder: decimalStringSchema,
  availableStock: decimalStringSchema,
  shortfall: decimalStringSchema,
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
  /** The approver in Navision's Approval User Setup shape, from area 4's policy. */
  approver: z.object({
    displayName: z.string().min(1),
    setup: approvalUserSetupSchema,
  }),
  substituteName: z.string().min(1).nullable(),
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

export const sprDecisionResultSchema = notAppliedSchema.extend({
  recordNo: sprNumberSchema,
  outcome: z.enum(SPR_DECISIONS),
});
export type SprDecisionResult = z.infer<typeof sprDecisionResultSchema>;

export const paymentResultSchema = notAppliedSchema.extend({
  orderNo: orderNoSchema,
});
export type PaymentResult = z.infer<typeof paymentResultSchema>;
