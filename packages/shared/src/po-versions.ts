// The contract of PO versions (ADR 0074). A submitted order's current PO is its
// head row; a PO that a later one replaced is read back as a version. The price
// of a version and of a difference is masked by the server, so a role that may
// not see prices gets an object with no value, no `from`, no `to` and no
// `changed`: the page cannot show what it was never sent.

import { z } from "zod";
import { dataEnvelope } from "./envelope.js";
import {
  classificationSchema,
  maskReasonSchema,
} from "./governance/classification.js";
import { maskedFieldSchema } from "./governance/masking.js";
import { decimalStringSchema } from "./money.js";
import {
  SHIPMENT_BEFORE_ORDER_MESSAGE,
  createSalesOrderFields,
  createSalesOrderSchema,
  salesOrderDetailSchema,
  salesOrderLineSchema,
  shipmentIsBeforeOrder,
} from "./orders.js";

/** The column is an INTEGER. */
export const PO_VERSION_NO_MAX = 2_147_483_647;
export const poVersionNoSchema = z.int().min(1).max(PO_VERSION_NO_MAX);

/** The path of the one detail a stale confirmation carries: the number the order is at now. */
export const PO_VERSION_STALE_PATH = "currentPoVersionNo";
/** The path of the one detail a read or write of a draft or a void order carries. */
export const PO_VERSION_STATE_PATH = "captureState";

/** Preview takes the body of a new order: it is the PO as the customer sent it again. */
export const previewPoVersionSchema = createSalesOrderSchema;
export type PreviewPoVersionBody = z.infer<typeof previewPoVersionSchema>;

/**
 * Confirm takes the same body, a literal `confirmed: true` and the number the
 * person compared with. There is no `.pipe()` and no transform anywhere in
 * these schemas: the OpenAPI writer reads the input side.
 */
export const confirmPoVersionSchema = createSalesOrderFields
  .extend({
    confirmed: z.literal(true),
    expectedPoVersionNo: poVersionNoSchema,
  })
  .refine((body) => !shipmentIsBeforeOrder(body.orderDate, body.shipmentDate), {
    path: ["shipmentDate"],
    message: SHIPMENT_BEFORE_ORDER_MESSAGE,
  });
export type ConfirmPoVersionBody = z.infer<typeof confirmPoVersionSchema>;

// `.coerce` chained directly, as the other schemas do: a pipe would hide the
// integer, the minimum and the maximum from the OpenAPI writer.
export const poVersionParamSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(PO_VERSION_NO_MAX);

export const poVersionDiffQuerySchema = z.object({
  from: z.coerce.number().int().min(1).max(PO_VERSION_NO_MAX),
  to: z.coerce.number().int().min(1).max(PO_VERSION_NO_MAX),
});
export type PoVersionDiffQuery = z.infer<typeof poVersionDiffQuerySchema>;

// Strict: a masked price that carries a number is a leak, so the schema refuses it.
const maskedPriceSchema = z.strictObject({
  masked: z.literal(true),
  field: z.string().min(1),
  classification: classificationSchema,
  reason: maskReasonSchema,
});
const shownPriceSchema = z.object({
  masked: z.literal(false),
  from: decimalStringSchema.nullable(),
  to: decimalStringSchema.nullable(),
  changed: z.boolean(),
});
/** A price or a total of a difference: shown with both sides, or masked with neither. */
export const priceDifferenceSchema = z.discriminatedUnion("masked", [
  shownPriceSchema,
  maskedPriceSchema,
]);
export type PriceDifference = z.infer<typeof priceDifferenceSchema>;

export const PO_HEADER_FIELDS = [
  "orderDate",
  "shipmentDate",
  "prepaymentPercent",
  "currencyCode",
] as const;

export const headerDifferenceSchema = z.object({
  field: z.enum(PO_HEADER_FIELDS),
  from: z.string().nullable(),
  to: z.string().nullable(),
  changed: z.boolean(),
});

/**
 * One line of a differences view. Read `status` to know what happened to the
 * line: `quantity.changed` and the price's `changed` are false for an added or
 * a removed line (there is nothing to compare), even though `from` or `to`
 * holds a value, so a reader of `changed` alone would draw it as unchanged.
 */
export const lineDifferenceSchema = z.object({
  status: z.enum(["added", "removed", "changed", "unchanged"]),
  itemNo: z.string().min(1),
  description: z.string().min(1),
  fromLineNo: z.int().nullable(),
  toLineNo: z.int().nullable(),
  moved: z.boolean(),
  quantity: z.object({
    from: decimalStringSchema.nullable(),
    to: decimalStringSchema.nullable(),
    changed: z.boolean(),
  }),
  unitPrice: priceDifferenceSchema,
});
export type LineDifferenceView = z.infer<typeof lineDifferenceSchema>;

export const poVersionDifferencesSchema = z.object({
  fromPoVersionNo: poVersionNoSchema,
  toPoVersionNo: poVersionNoSchema,
  /** No header field, line or line position differs. Descriptions are not compared. */
  identical: z.boolean(),
  /** False for a role that cannot see prices: status and `identical` then ignore price. */
  pricesCompared: z.boolean(),
  header: z.array(headerDifferenceSchema),
  total: priceDifferenceSchema,
  lines: z.array(lineDifferenceSchema),
  counts: z.object({
    added: z.int().min(0),
    removed: z.int().min(0),
    changed: z.int().min(0),
    moved: z.int().min(0),
    unchanged: z.int().min(0),
  }),
});
export type PoVersionDifferences = z.infer<typeof poVersionDifferencesSchema>;

export const poVersionSummarySchema = z.object({
  poVersionNo: poVersionNoSchema,
  current: z.boolean(),
  arrivedAt: z.iso.datetime(),
  arrivedBy: z.string().nullable(),
  supersededAt: z.iso.datetime().nullable(),
  supersededBy: z.string().nullable(),
  lineCount: z.int().min(1),
  total: maskedFieldSchema,
});
export type PoVersionSummary = z.infer<typeof poVersionSummarySchema>;

export const poVersionDetailSchema = poVersionSummarySchema.extend({
  orderDate: z.string(),
  shipmentDate: z.string().nullable(),
  currencyCode: z.string(),
  prepaymentPercent: decimalStringSchema,
  lines: z.array(salesOrderLineSchema.omit({ shortBy: true })),
});
export type PoVersionDetail = z.infer<typeof poVersionDetailSchema>;

/** Newest first. */
export const poVersionListSchema = z.object({
  orderNo: z.string(),
  currentPoVersionNo: poVersionNoSchema,
  versions: z.array(poVersionSummarySchema),
});
export type PoVersionList = z.infer<typeof poVersionListSchema>;

export const poVersionListResponseSchema = dataEnvelope(poVersionListSchema);
export const poVersionDetailResponseSchema = dataEnvelope(
  poVersionDetailSchema,
);
export const poVersionDifferencesResponseSchema = dataEnvelope(
  poVersionDifferencesSchema,
);

export const poVersionConfirmedSchema = z.object({
  poVersionNo: poVersionNoSchema,
  supersedesPoVersionNo: poVersionNoSchema,
  differences: poVersionDifferencesSchema,
  order: salesOrderDetailSchema,
});
export type PoVersionConfirmedView = z.infer<typeof poVersionConfirmedSchema>;
export const poVersionConfirmedResponseSchema = dataEnvelope(
  poVersionConfirmedSchema,
);
