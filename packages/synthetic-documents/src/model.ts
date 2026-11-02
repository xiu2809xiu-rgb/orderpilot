import type { DocumentType } from "@orderpilot/shared";
import type { Box } from "./canvas.js";

/** The label every page carries, and the ground truth repeats. */
export const DEMO_LABEL = "Synthetic demo data";

export const DOCUMENT_KINDS = [
  "CUSTOMER_PO",
  "PROFORMA_INVOICE",
  "PACKING_LIST",
  "SALES_INVOICE",
] as const satisfies readonly DocumentType[];
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/**
 * Four looks for a customer's PO, and the one house style of Spectra's own
 * documents (PI, packing list, invoice).
 */
export const PO_LAYOUTS = ["boxed", "letter", "table", "branded"] as const;
export type PoLayout = (typeof PO_LAYOUTS)[number];
export type LayoutId = PoLayout | "house";

export const FIELD_GROUPS = ["header", "lines", "totals", "bank"] as const;
export type FieldGroup = (typeof FIELD_GROUPS)[number];

/** What a layout is told about a field before it knows where the field goes. */
export interface FieldSpec {
  /** Stable across layouts: `poNumber`, `lines.unitPrice`. */
  key: string;
  /** The plain name a person sees: "PO number". */
  label: string;
  group: FieldGroup;
  /** Zero-based, for a field on a line; null for the rest. */
  lineIndex: number | null;
  /** The value as a system holds it: an ISO date, a decimal string. */
  value: string;
  /** The text as printed, on several lines for an address. */
  text: string;
}

export interface DraftField extends FieldSpec {
  page: number;
  /** In points from the top-left corner. */
  box: Box;
}

/** [x, y, width, height] as fractions of the page, the shape the shared contract holds. */
export type BoxFractions = [number, number, number, number];

export interface PlacedField extends FieldSpec {
  /** `poNumber`, or `lines.unitPrice[0]` for the first line. */
  id: string;
  /** From 1. */
  page: number;
  box: BoxFractions;
  /** What Mock AI would report for this field, from 0 to 1. */
  confidence: number;
  /** Below the shared threshold: a person must confirm it. */
  uncertain: boolean;
}

export function fieldId(key: string, lineIndex: number | null): string {
  return lineIndex === null ? key : `${key}[${String(lineIndex)}]`;
}

export function spec(
  key: string,
  label: string,
  group: FieldGroup,
  value: string,
  text: string = value,
  lineIndex: number | null = null,
): FieldSpec {
  return { key, label, group, lineIndex, value, text };
}
