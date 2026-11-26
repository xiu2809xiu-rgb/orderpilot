const FOCUSABLE = "button:not([disabled]), input, select, a[href]";

/** The first control in the nearest earlier sibling of the row that has one: the filter bar above it. */
function focusAbove(row: Element) {
  for (
    let before = row.previousElementSibling;
    before;
    before = before.previousElementSibling
  ) {
    const target =
      before instanceof HTMLElement && before.matches(FOCUSABLE)
        ? before
        : before.querySelector<HTMLElement>(FOCUSABLE);
    if (target) {
      target.focus();
      return;
    }
  }
}

/** Clear all takes the whole row away, itself included, so focus goes up to the filters. */
export function focusAfterClearAll(item: HTMLElement | null) {
  if (item?.parentElement) focusAbove(item.parentElement);
}

/**
 * Called as a pill's button is pressed, before the pill goes. Focus moves to
 * the next pill, or to Clear all (the row's last item), so a keyboard user is
 * never dropped to the top of the page. When it was the only pill the whole
 * row goes, Clear all with it, so focus goes up to the filters instead.
 */
export function focusAfterClear(pill: HTMLElement | null) {
  const row = pill?.parentElement;
  if (!pill || !row) return;
  const live = Array.from(row.children).filter(
    (item): item is HTMLElement =>
      item instanceof HTMLElement && !item.hasAttribute("data-leaving"),
  );
  const others = live.filter(
    (item) => item !== pill && item.hasAttribute("data-chip"),
  );
  if (others.length === 0) {
    focusAbove(row);
    return;
  }
  const at = live.indexOf(pill);
  const target = live[at + 1] ?? live[at - 1];
  target?.querySelector<HTMLElement>("button")?.focus();
}
