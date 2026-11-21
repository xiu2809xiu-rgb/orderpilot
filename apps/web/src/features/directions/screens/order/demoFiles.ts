import type { DocumentType } from "@orderpilot/shared";

/**
 * The twelve demo PDFs in `apps/web/public/demo-documents`, by the order and
 * the kind of document each is for (the README there lists them). An order
 * has a file only if it is in this table; every other document of the demo
 * data has none, and the page says so instead of showing a control that goes
 * nowhere. The files are matched on the order number and the type, never on
 * the number printed on the file: a proforma invoice's number carries the day
 * it was made, so it can differ from the app's.
 */
const DEMO_FILES: Readonly<Record<string, string>> = {
  "SO-0001|SALES_INVOICE": "invoice-so-0001.pdf",
  "SO-0026|PACKING_LIST": "pl-so-0026.pdf",
  "SO-0041|CUSTOMER_PO": "po-table-so-0041.pdf",
  "SO-0041|PACKING_LIST": "pl-so-0041-mismatch.pdf",
  "SO-0051|PROFORMA_INVOICE": "pi-so-0051.pdf",
  "SO-0063|PROFORMA_INVOICE": "pi-so-0063.pdf",
  "SO-0075|PROFORMA_INVOICE": "pi-so-0075.pdf",
  "SO-0101|CUSTOMER_PO": "po-branded-so-0101.pdf",
  "SO-0102|CUSTOMER_PO": "po-boxed-so-0102.pdf",
  "SO-0115|CUSTOMER_PO": "po-table-so-0115.pdf",
  "SO-0119|CUSTOMER_PO": "po-letter-so-0119.pdf",
  "SO-0120|CUSTOMER_PO": "po-letter-so-0120-scanned.pdf",
};

/** Every file name the table points at, so a test can check each one exists. */
export const DEMO_FILE_NAMES: readonly string[] = Object.values(DEMO_FILES);

/** The address of the demo PDF for a document of an order, or null when the demo set has none. */
export function demoFileFor(
  orderNo: string,
  type: DocumentType,
): string | null {
  const file = DEMO_FILES[`${orderNo}|${type}`];
  return file ? `/demo-documents/${file}` : null;
}

/**
 * Whether a document's file prints prices, so that only a role that may see
 * prices may open it. The demo set's packing lists are made without a price
 * column (`priced` is false in `packages/synthetic-documents`), so they stay
 * open to every role that can open the order. A proforma invoice also prints
 * Spectra's demo bank details; the order's API does not say whether a role may
 * see those, so for now it is held to the same price rule (see the pull
 * request: the server owes the page that answer).
 */
export function printsPrices(type: DocumentType): boolean {
  return (
    type === "CUSTOMER_PO" ||
    type === "PROFORMA_INVOICE" ||
    type === "SALES_INVOICE"
  );
}
