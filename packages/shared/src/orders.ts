// The contract of the Orders list and the order reader (ADR 0046). An order is
// either a sample (generated, never stored) or a stored row that OrderPilot
// made itself. Names carry the `salesOrder` prefix because `order.ts` already
// holds the P-7 order contract.

import { z } from "zod";
import { dataEnvelope, pageEnvelope, pageQuerySchema } from "./envelope.js";
import type { FieldIssue } from "./errors.js";
import { maskedFieldSchema } from "./governance/masking.js";
import { AVAILABLE_STOCK_MAX_ITEMS, navisionNoSchema } from "./master-data.js";
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
  /** Counts the saves of a draft. Null for a sample: it cannot be edited. */
  version: z.int().min(1).nullable(),
  lines: z.array(salesOrderLineSchema),
});
export type SalesOrderDetail = z.infer<typeof salesOrderDetailSchema>;

/** A stored order is real, so unlike master data these carry no `meta.mock`. */
export const salesOrderListSchema = pageEnvelope(salesOrderRowSchema);
export const salesOrderResponseSchema = dataEnvelope(salesOrderDetailSchema);

// ---- Writing a draft order (ADR 0047) -----------------------------------------
// No `.default` and no `.transform` below: a default survives `.partial()` and
// would wipe a field the caller did not send, and the OpenAPI writer
// (`openApiSchema`) throws on a transform.

export const ORDER_MAX_LINES = AVAILABLE_STOCK_MAX_ITEMS;
/** The longest PO number, after trimming. The order form says so before the API does. */
export const ORDER_PO_MAX_LENGTH = 35;
/** Above zero, three decimals at most: the column is a Decimal(18, 3). */
export const ORDER_QUANTITY_PATTERN = /^(?!0+(\.0+)?$)\d{1,15}(\.\d{1,3})?$/;
/** Two decimals at most: the column is a Decimal(18, 2). */
export const ORDER_PRICE_PATTERN = /^\d{1,15}(\.\d{1,2})?$/;
/** Zero to 999.99: the column is a Decimal(5, 2), and the server holds 100. */
export const ORDER_PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

const orderLineBodySchema = z.object({
  itemNo: navisionNoSchema,
  /** Blank takes the item's own description. */
  description: z.string().trim().max(100).optional(),
  quantity: z.string().regex(ORDER_QUANTITY_PATTERN),
  /** Required for a role that sees prices, and refused for one that does not. */
  unitPrice: z.string().regex(ORDER_PRICE_PATTERN).optional(),
});

/**
 * True when the shipment date falls before the order date. Both are
 * `YYYY-MM-DD`, so comparing the text compares the days. A missing or blank
 * date is not before anything. The form and the API both ask this one
 * question, so they cannot disagree about it.
 */
export function shipmentIsBeforeOrder(
  orderDate: string | null | undefined,
  shipmentDate: string | null | undefined,
): boolean {
  if (!orderDate || !shipmentDate) return false;
  return shipmentDate < orderDate;
}

/** The API's words for the refusal; the form words it again in its own locale. */
export const SHIPMENT_BEFORE_ORDER_MESSAGE =
  "The shipment date cannot be before the order date.";

// The fields apart from the cross-field check, which is a refinement: a
// refinement is lost on .partial(), so the patch is built from this and
// carries the check itself.
const createSalesOrderFields = z.object({
  customerNo: navisionNoSchema,
  externalDocumentNo: z.string().trim().min(1).max(ORDER_PO_MAX_LENGTH),
  orderDate: z.iso.date(),
  shipmentDate: z.iso.date().nullable(),
  prepaymentPercent: z.string().regex(ORDER_PERCENT_PATTERN),
  lines: z.array(orderLineBodySchema).min(1).max(ORDER_MAX_LINES),
});

export const createSalesOrderSchema = createSalesOrderFields.refine(
  (body) => !shipmentIsBeforeOrder(body.orderDate, body.shipmentDate),
  { path: ["shipmentDate"], message: SHIPMENT_BEFORE_ORDER_MESSAGE },
);
export type CreateSalesOrderBody = z.infer<typeof createSalesOrderSchema>;

/**
 * Only the fields sent change. `version` is the one the form was typed against.
 * A patch that sends one of the two dates is checked against the stored other
 * by the order itself; this check covers a patch that sends both.
 */
export const patchSalesOrderSchema = createSalesOrderFields
  .partial()
  .extend({ version: z.int().min(1) })
  .refine((body) => Object.keys(body).some((key) => key !== "version"), {
    message: "Send at least one field to change",
  })
  .refine((body) => !shipmentIsBeforeOrder(body.orderDate, body.shipmentDate), {
    path: ["shipmentDate"],
    message: SHIPMENT_BEFORE_ORDER_MESSAGE,
  });
export type PatchSalesOrderBody = z.infer<typeof patchSalesOrderSchema>;

export const voidSalesOrderSchema = z.object({
  version: z.int().min(1),
  reason: z.string().trim().min(1).max(500),
});
export type VoidSalesOrderBody = z.infer<typeof voidSalesOrderSchema>;

/**
 * The 409 for a repeated customer and PO number keeps the one error envelope.
 * It carries the existing order's number as the message of an issue on this
 * path, so the form can link to it.
 */
export const DUPLICATE_ORDER_PATH = "existingOrderNo";

/** The number of the order a 409 names, or null when it names none. */
export function existingOrderOf(
  details: readonly FieldIssue[] | null | undefined,
): string | null {
  const issue = details?.find((item) => item.path === DUPLICATE_ORDER_PATH);
  return issue && issue.message.length > 0 ? issue.message : null;
}
