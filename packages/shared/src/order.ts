// DRAFT for the team to agree in Week 3. Names may change until then; nothing
// outside the platform stories should depend on them yet.
//
// Names follow Navision's, in camelCase (Sales Header, Sales Line). Order status
// belongs to area 2's state machine and is not defined here: `navisionStatus` is
// only a read-only mirror of what Navision shows.

import { z } from "zod";
import { decimalStringSchema } from "./money.js";
import { recordRefSchema } from "./record-number.js";

// ---- Documents -------------------------------------------------------------

export const DOCUMENT_TYPES = [
  "CUSTOMER_PO",
  "PROFORMA_INVOICE",
  "VENDOR_PI",
  "SALES_INVOICE",
  "PACKING_LIST",
  "AWB",
  "BILL_OF_LADING",
  "IMPORT_PERMIT",
  "PAYMENT_ADVICE",
  "OTHER",
] as const;
export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof documentTypeSchema>;

export const documentRefSchema = z.object({
  id: z.uuid(),
  type: documentTypeSchema,
  fileName: z.string().min(1),
  receivedAt: z.iso.datetime(),
  // Where it came from: an email address or "upload".
  source: z.string().min(1),
});
export type DocumentRef = z.infer<typeof documentRefSchema>;

// ---- Field values with confidence and provenance ---------------------------

export const FIELD_METHODS = ["ai", "rule", "person", "navision"] as const;

/** Where a value was read from, so a person can click through to the evidence. */
export const provenanceSchema = z.object({
  documentId: z.uuid(),
  page: z.int().min(1).nullable(),
  // [x, y, width, height] as fractions of the page, or null when unknown.
  box: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullable(),
  // The text as printed, before any normalising.
  sourceText: z.string().nullable(),
  method: z.enum(FIELD_METHODS),
  // The model and prompt version, when method is "ai".
  model: z.string().nullable(),
});
export type Provenance = z.infer<typeof provenanceSchema>;

/** A value plus how sure we are and where it came from. Confidence is a ratio, 0 to 1. */
export function fieldValue<T extends z.ZodType>(value: T) {
  return z.object({
    value,
    confidence: z.number().min(0).max(1),
    provenance: provenanceSchema,
    // A person has the last word: extracted, then confirmed or corrected.
    review: z.enum(["extracted", "confirmed", "corrected"]),
  });
}
export const textFieldSchema = fieldValue(z.string());
export type TextField = z.infer<typeof textFieldSchema>;
export const decimalFieldSchema = fieldValue(decimalStringSchema);
export type DecimalField = z.infer<typeof decimalFieldSchema>;

// ---- Sales header and lines (Navision names, camelCase) --------------------

/** Navision's own status, shown as it is. OrderPilot's order status is area 2's. */
export const NAVISION_STATUSES = [
  "Open",
  "Released",
  "Pending Approval",
  "Pending Prepayment",
] as const;
export const navisionStatusSchema = z.enum(NAVISION_STATUSES);
export type NavisionStatus = z.infer<typeof navisionStatusSchema>;

export const salesHeaderSchema = z.object({
  no: z.string().min(1),
  sellToCustomerNo: z.string().min(1),
  // The customer's PO number. With sellToCustomerNo it drives the duplicate check.
  externalDocumentNo: z.string().min(1),
  orderDate: z.iso.date(),
  shipmentDate: z.iso.date().nullable(),
  currencyCode: z.string().length(3),
  // 0 to 100, as a decimal string.
  prepaymentPercent: decimalStringSchema,
  shipmentMethodCode: z.string().nullable(),
  shippingAgentCode: z.string().nullable(),
  // The AWB or BL number, filled after approval.
  packageTrackingNo: z.string().nullable(),
  // Read-only mirror of Navision. Never set by OrderPilot.
  navisionStatus: navisionStatusSchema.nullable(),
});
export type SalesHeader = z.infer<typeof salesHeaderSchema>;

export const SALES_LINE_TYPES = ["Item", "Comment"] as const;

export const salesLineSchema = z.object({
  type: z.enum(SALES_LINE_TYPES),
  no: z.string().min(1),
  description: z.string(),
  quantity: decimalStringSchema,
  unitPrice: decimalStringSchema,
  lineAmount: decimalStringSchema,
  qtyToShip: decimalStringSchema,
  quantityShipped: decimalStringSchema,
});
export type SalesLine = z.infer<typeof salesLineSchema>;

/** An order as OrderPilot holds it: the header, its lines and the documents behind it. */
export const orderSchema = z.object({
  id: z.uuid(),
  // OrderPilot's number beside Navision's.
  ref: recordRefSchema.nullable(),
  header: salesHeaderSchema,
  lines: z.array(salesLineSchema),
  documents: z.array(documentRefSchema),
});
export type Order = z.infer<typeof orderSchema>;

/** What the AI reads off a customer PO: every header field and line field, with evidence. */
export const extractedOrderSchema = z.object({
  documentId: z.uuid(),
  header: z.object({
    sellToCustomerNo: textFieldSchema.nullable(),
    externalDocumentNo: textFieldSchema.nullable(),
    orderDate: textFieldSchema.nullable(),
    shipmentDate: textFieldSchema.nullable(),
    currencyCode: textFieldSchema.nullable(),
    prepaymentPercent: decimalFieldSchema.nullable(),
    shipmentMethodCode: textFieldSchema.nullable(),
  }),
  lines: z.array(
    z.object({
      no: textFieldSchema.nullable(),
      description: textFieldSchema.nullable(),
      quantity: decimalFieldSchema.nullable(),
      unitPrice: decimalFieldSchema.nullable(),
    }),
  ),
});
export type ExtractedOrder = z.infer<typeof extractedOrderSchema>;
