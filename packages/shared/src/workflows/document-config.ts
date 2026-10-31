import { z } from "zod";
import { DOCUMENT_TYPES } from "../order.js";

/**
 * Field settings and default values for each document type. They are held as
 * configuration (the DocumentTypeConfig table, seeded from the list below), so
 * changing a default is an edit to a row, never a code change.
 */
export const CONFIGURABLE_DOCUMENT_TYPES = ["SPR", ...DOCUMENT_TYPES] as const;
export const configurableDocumentTypeSchema = z.enum(
  CONFIGURABLE_DOCUMENT_TYPES,
);
export type ConfigurableDocumentType = z.infer<
  typeof configurableDocumentTypeSchema
>;

export const FIELD_KINDS = ["text", "number", "date", "choice"] as const;

export const documentFieldSchema = z.object({
  key: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
  label: z.string().min(1),
  kind: z.enum(FIELD_KINDS),
  required: z.boolean(),
  visible: z.boolean(),
  defaultValue: z.string().nullable(),
  /** The allowed values when kind is "choice". */
  choices: z.array(z.string()),
});
export type DocumentField = z.infer<typeof documentFieldSchema>;

export const documentTypeConfigSchema = z.object({
  documentType: configurableDocumentTypeSchema,
  label: z.string().min(1),
  fields: z.array(documentFieldSchema),
});
export type DocumentTypeConfig = z.infer<typeof documentTypeConfigSchema>;

type FieldOptions = Partial<
  Pick<DocumentField, "required" | "defaultValue" | "choices">
>;

function field(
  key: string,
  label: string,
  kind: DocumentField["kind"],
  options: FieldOptions = {},
): DocumentField {
  return {
    key,
    label,
    kind,
    required: options.required ?? false,
    visible: true,
    defaultValue: options.defaultValue ?? null,
    choices: options.choices ?? [],
  };
}

/** Where a fresh database starts. The live values are the table's. */
export const DEFAULT_DOCUMENT_CONFIG: readonly DocumentTypeConfig[] = [
  {
    documentType: "SPR",
    label: "Stock purchase request",
    fields: [
      field("vendorNo", "Vendor", "text", { required: true }),
      field("itemNo", "Item", "text", { required: true }),
      field("quantity", "Quantity", "number", { required: true }),
      field("needBy", "Needed by", "date"),
      field("deliveryTerms", "Delivery terms", "choice", {
        defaultValue: "FOB",
        choices: ["FOB", "CIF", "EXW"],
      }),
      field("notes", "Notes", "text"),
    ],
  },
  {
    documentType: "PROFORMA_INVOICE",
    label: "Pro forma invoice",
    fields: [
      field("validityDays", "Valid for (days)", "number", {
        required: true,
        defaultValue: "14",
      }),
      field("paymentTerms", "Payment terms", "choice", {
        defaultValue: "PREPAYMENT",
        choices: ["PREPAYMENT", "NET30", "NET60"],
      }),
      field("currencyCode", "Currency", "text", {
        required: true,
        defaultValue: "USD",
      }),
    ],
  },
  {
    documentType: "SALES_INVOICE",
    label: "Sales invoice",
    fields: [
      field("paymentTerms", "Payment terms", "choice", {
        defaultValue: "NET30",
        choices: ["PREPAYMENT", "NET30", "NET60"],
      }),
      field("dueInDays", "Due in (days)", "number", { defaultValue: "30" }),
    ],
  },
  {
    documentType: "PACKING_LIST",
    label: "Packing list",
    fields: [
      field("cartonCount", "Cartons", "number", { required: true }),
      field("grossWeightKg", "Gross weight (kg)", "number"),
    ],
  },
];
