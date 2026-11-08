// The contract of the Orders list and the order reader (ADR 0046). An order is
// either a sample (generated, never stored) or a stored row that OrderPilot
// made itself. Names carry the `salesOrder` prefix because `order.ts` already
// holds the P-7 order contract.

import { z } from "zod";
import { dataEnvelope, pageEnvelope, pageQuerySchema } from "./envelope.js";
import { maskedFieldSchema } from "./governance/masking.js";
import { decimalStringSchema } from "./money.js";

/**
 * How far the entry of an order has got. It is not the order's status: that
 * stays in area 2's state machine.
 */
export const ORDER_CAPTURE_STATES = ["draft", "submitted", "void"] as const;
export const orderCaptureStateSchema = z.enum(ORDER_CAPTURE_STATES);
export type OrderCaptureState = z.infer<typeof orderCaptureStateSchema>;

export const ORDER_SOURCES = ["sample", "stored"] as const;
export const orderSourceSchema = z.enum(ORDER_SOURCES);
export type OrderSource = z.infer<typeof orderSourceSchema>;

export const ORDER_SORT_COLUMNS = [
  "orderNo",
  "customerNo",
  "orderDate",
  "shipmentDate",
  "amount",
  "captureState",
] as const;

const filterText = z.string().trim().min(1).max(60).optional();

export const salesOrderQuerySchema = pageQuerySchema.extend({
  search: z.string().trim().max(100).optional(),
  customerNo: filterText,
  captureState: orderCaptureStateSchema.optional(),
  source: orderSourceSchema.optional(),
  orderDateFrom: z.iso.date().optional(),
  orderDateTo: z.iso.date().optional(),
  amountFrom: decimalStringSchema.optional(),
  amountTo: decimalStringSchema.optional(),
  /**
   * The one value is `waiting`, never `true`: a filter that is text in the
   * address bar must not be read back as a boolean.
   */
  stock: z.enum(["waiting"]).optional(),
  sort: z.enum(ORDER_SORT_COLUMNS).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});
export type SalesOrderQuery = z.infer<typeof salesOrderQuerySchema>;

/** An item an order asks more of than is on hand. */
export const salesOrderShortageSchema = z.object({
  itemNo: z.string().min(1),
  ordered: decimalStringSchema,
  availableStock: decimalStringSchema,
  shortBy: decimalStringSchema,
});
export type SalesOrderShortage = z.infer<typeof salesOrderShortageSchema>;

export const salesOrderRowSchema = z.object({
  orderNo: z.string().min(1),
  source: orderSourceSchema,
  /** Null for a sample: it was never entered here. */
  captureState: orderCaptureStateSchema.nullable(),
  customerNo: z.string().min(1),
  /** Master data's name for the number, shown beside it. Null when none is known; matching stays on the number. */
  customerName: z.string().min(1).nullable(),
  externalDocumentNo: z.string().min(1),
  orderDate: z.string().min(1),
  shipmentDate: z.string().nullable(),
  /** Area 2's label as text. Null for a stored order: it has no workflow yet. */
  workflowStatus: z.string().min(1).nullable(),
  /** Masked with the selling price: a total gives the prices away. */
  amount: maskedFieldSchema,
  currencyCode: z.string().min(1),
  /** The largest gap, or null when stock covers the order. */
  shortage: salesOrderShortageSchema.nullable(),
  /** How many items are short in all. */
  shortageCount: z.int().min(0),
});
export type SalesOrderRow = z.infer<typeof salesOrderRowSchema>;

export const salesOrderLineSchema = z.object({
  lineNo: z.int().min(1),
  itemNo: z.string().min(1),
  description: z.string().min(1),
  quantity: decimalStringSchema,
  qtyToShip: decimalStringSchema,
  unitPrice: maskedFieldSchema,
  lineAmount: maskedFieldSchema,
  /** How far this line's item falls short of the order, or null. */
  shortBy: decimalStringSchema.nullable(),
});
export type SalesOrderLine = z.infer<typeof salesOrderLineSchema>;

export const salesOrderDetailSchema = salesOrderRowSchema.extend({
  prepaymentPercent: decimalStringSchema,
  navisionNo: z.string().min(1).nullable(),
  lines: z.array(salesOrderLineSchema),
});
export type SalesOrderDetail = z.infer<typeof salesOrderDetailSchema>;

/** A stored order is real, so unlike master data these carry no `meta.mock`. */
export const salesOrderListSchema = pageEnvelope(salesOrderRowSchema);
export const salesOrderResponseSchema = dataEnvelope(salesOrderDetailSchema);
