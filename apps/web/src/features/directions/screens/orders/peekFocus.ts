/**
 * What opens the side peek wears `data-peek-opener` with its order's number: a
 * row's menu button and a board card's button. The peek has no trigger of its
 * own, so the dialog has nowhere to return focus to and leaves it at the top
 * of the page; this finds the control to give it back to.
 */
const PEEK_OPENER = "data-peek-opener";

/** Puts focus back on the control that opened the peek for this order. False when it is not on screen. */
export function focusPeekOpener(orderNo: string): boolean {
  const openers = document.querySelectorAll<HTMLElement>(`[${PEEK_OPENER}]`);
  for (const opener of openers) {
    if (opener.getAttribute(PEEK_OPENER) === orderNo) {
      opener.focus();
      return true;
    }
  }
  return false;
}
