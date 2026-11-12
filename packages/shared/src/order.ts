// DRAFT for the team to agree in Week 3. Names may change until then; nothing
// outside the platform stories should depend on them yet.
//
// Names follow Business Central's, in camelCase (Sales Header, Sales Line). Order status
// belongs to area 2's state machine and is not defined here: `navisionStatus` is
// only a read-only mirror of what Business Central shows.

import { z } from "zod";
import { decimalStringSchema } from "./money.js";
import { recordRefSchema } from "./record-number.js";

// ---- Documents -------------------------------------------------------------

/**
 * What a document is, never who issued it: a vendor's packing list is a
 * PACKING_LIST and a customer's proof of payment is PAYMENT_ADVICE.
 * SPR_FORM is the form as a file someone uploads or prints. The request
 * record's own settings are the "SPR" entry of CONFIGURABLE_DOCUMENT_TYPES.
 */
export const DOCUMENT_TYPES = [
  "CUSTOMER_PO",
  "PROFORMA_INVOICE",
  "VENDOR_PI",
  "VENDOR_INVOICE",
  "SALES_INVOICE",
  "CREDIT_NOTE",
  "PACKING_LIST",
  "DELIVERY_ORDER",
  "AWB",
  "BILL_OF_LADING",
  "IMPORT_PERMIT",
  "PAYMENT_ADVICE",
  "SPR_FORM",
  "OTHER",
] as const;
export const documentTypeSchema = z.enum(DOCUMENT_TYPES);
export type DocumentType = z.infer<typeof documentTypeSchema>;

/**
 * Whether a shipping paper is still a draft or is final. It is a marker on the
 * document, not more types, so one rule on "an AWB" still reads both. A
 * forwarder's draft is checked before the final is issued.
 */
export const DOCUMENT_STAGES = ["draft", "final"] as const;
export const documentStageSchema = z.enum(DOCUMENT_STAGES);
export type DocumentStage = z.infer<typeof documentStageSchema>;

/** The only types that pass through a draft first. */
export const STAGED_DOCUMENT_TYPES = ["AWB", "BILL_OF_LADING"] as const;

export function isStagedDocumentType(type: DocumentType): boolean {
  return (STAGED_DOCUMENT_TYPES as readonly string[]).includes(type);
}

export const documentRefSchema = z
  .object({
    id: z.uuid(),
    type: documentTypeSchema,
    fileName: z.string().min(1),
    receivedAt: z.iso.datetime(),
    // Where it came from: an email address or "upload".
    source: z.string().min(1),
    // Absent means not known or not applicable, and is valid for every type.
    stage: documentStageSchema.optional(),
  })
  .refine((ref) => ref.stage === undefined || isStagedDocumentType(ref.type), {
    path: ["stage"],
    message: "Only an AWB or a bill of lading has a draft or final stage",
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

// ---- Sales header and lines (Business Central names, camelCase) --------------------

/** Business Central's own status, shown as it is. OrderPilot's order status is area 2's. */
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
  // Read-only mirror of Business Central. Never set by OrderPilot.
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
  // OrderPilot's number beside Business Central's.
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
