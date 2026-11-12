import type { DocumentStage } from "@orderpilot/shared";
import type { Box } from "./canvas.js";

/** The label every page carries, and the ground truth repeats. */
export const DEMO_LABEL = "Synthetic demo data";

/**
 * The renderer's own ids. The name of a kind is read by the confidence hash, so
 * a name here never changes. A definition carries the contract type a
 * classifier would answer (`DocumentDefinition.type`).
 */
export const DOCUMENT_KINDS = [
  "CUSTOMER_PO",
  "PROFORMA_INVOICE",
  "PACKING_LIST",
  "SALES_INVOICE",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** The four kinds the original layouts draw. New kinds are drawn by their own definitions. */
export type LegacyKind =
  "CUSTOMER_PO" | "PROFORMA_INVOICE" | "PACKING_LIST" | "SALES_INVOICE";
export const LEGACY_KINDS: readonly LegacyKind[] = [
  "CUSTOMER_PO",
  "PROFORMA_INVOICE",
  "PACKING_LIST",
  "SALES_INVOICE",
];

export type Stage = DocumentStage;
export const ISSUERS = [
  "spectra",
  "customer",
  "vendor",
  "forwarder",
  "bank",
  "authority",
] as const;
export type Issuer = (typeof ISSUERS)[number];
/** Relative to Spectra. */
export type Direction = "inbound" | "outbound" | "internal";

/**
 * Four looks for a customer's PO, and the one house style of Spectra's own
 * documents (PI, packing list, invoice).
 */
export const PO_LAYOUTS = ["boxed", "letter", "table", "branded"] as const;
export type PoLayout = (typeof PO_LAYOUTS)[number];
export const LEGACY_LAYOUTS = [...PO_LAYOUTS, "house"] as const;
/** The five looks the original layouts draw: `LAYOUTS` is keyed by these alone. */
export type LegacyLayout = (typeof LEGACY_LAYOUTS)[number];
export type LayoutId = LegacyLayout;

/** The first four keep their meaning. The rest are for kinds that come later. */
export const FIELD_GROUPS = [
  "header",
  "parties",
  "lines",
  "totals",
  "bank",
  "transport",
  "payment",
  "stock",
  "validity",
] as const;
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

/** What a renderer may change on a document so that a check has something to find. */
export const MISTAKE_KINDS = [
  "quantity",
  "unitPrice",
  "poReference",
  "partNumber",
  "bankDetails",
  "consignee",
] as const;
export type MistakeKind = (typeof MISTAKE_KINDS)[number];

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
