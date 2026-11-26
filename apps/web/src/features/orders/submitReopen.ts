/**
 * Pressing "Reload the order" in the submit dialog gives the page a new key, so
 * the dialog's own state is lost with the old page. This mark says that the
 * dialog was open for this order, so the page that mounts for the reloaded
 * draft can open it again at its first view, with the new edit token. It is
 * kept in memory and expires: a visit or a reload later must not open a dialog.
 */
const FRESH_MS = 10_000;

let marked: { orderNo: string; at: number } | null = null;

/** Notes that the dialog should open again once this order has been read again. */
export function markSubmitReopen(orderNo: string): void {
  marked = { orderNo, at: Date.now() };
}

/** True once for the marked order, and only within ten seconds of the mark. */
export function takeSubmitReopen(orderNo: string): boolean {
  const mark = marked;
  if (mark?.orderNo !== orderNo) return false;
  marked = null;
  return Date.now() - mark.at <= FRESH_MS;
}
