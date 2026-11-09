/**
 * The PO number as it is stored: trimmed, with runs of spaces made one. Case is
 * left alone so the page shows what the customer wrote. The duplicate rule
 * compares in upper case in SQL (the index's own definition), so "po-1" and
 * "PO-1" are still one order.
 */
export function normalisePoNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}
