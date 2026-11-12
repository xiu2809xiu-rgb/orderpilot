import type { AnyDefinition } from "../definition.js";
import type { DocumentKind } from "../model.js";
import { LEGACY_DEFINITIONS } from "./legacy.js";

/**
 * Every kind of document, by its id. Exhaustive on purpose: the compiler
 * refuses a kind id that has no line here, and `registry.test.ts` refuses the
 * other way round. A new kind is its own file, one id in `DOCUMENT_KINDS` and one line here.
 */
export const KINDS: Readonly<Record<DocumentKind, AnyDefinition>> = {
  CUSTOMER_PO: LEGACY_DEFINITIONS.CUSTOMER_PO,
  PROFORMA_INVOICE: LEGACY_DEFINITIONS.PROFORMA_INVOICE,
  PACKING_LIST: LEGACY_DEFINITIONS.PACKING_LIST,
  SALES_INVOICE: LEGACY_DEFINITIONS.SALES_INVOICE,
};
