/**
 * Which order was just submitted, so the page that opens for it can take focus
 * once. A mark is kept in memory and not in the router's history state, which a
 * browser keeps across a reload and a back button: a later visit, and a reload,
 * must not pull focus again.
 */
const FRESH_MS = 10_000;

let marked: { orderNo: string; at: number } | null = null;

/** Notes that this order has just been submitted, or just reloaded after a refused submit. */
export function markSubmittedFocus(orderNo: string): void {
  marked = { orderNo, at: Date.now() };
}

/** True once for the marked order, and only within ten seconds of the mark. */
export function takeSubmittedFocus(orderNo: string): boolean {
  const mark = marked;
  if (mark?.orderNo !== orderNo) return false;
  marked = null;
  return Date.now() - mark.at <= FRESH_MS;
}
