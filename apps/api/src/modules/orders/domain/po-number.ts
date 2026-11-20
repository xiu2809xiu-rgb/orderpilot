/**
 * The PO number as it is stored: trimmed, with runs of spaces made one. Case is
 * left alone so the page shows what the customer wrote. The duplicate rule
 * compares in upper case in SQL (the index's own definition), so "po-1" and
 * "PO-1" are still one order.
 */
export function normalisePoNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * What the duplicate rule compares: upper case, with every space left out, so
 * "aud-dup- 011930" and "AUD-DUP-011930" are one PO number. The stored number
 * keeps the customer's own spacing and case.
 */
export function poMatchKey(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}
