const FOCUSABLE = "button:not([disabled]), input, select, a[href]";

/**
 * The first control in the nearest earlier sibling of the row that has one:
 * the filter bar above it. Some pages have none (the row follows a heading, or
 * is the first thing in its panel), and then focus goes to the page's heading,
 * made focusable for the purpose, so it never falls to the top of the page.
 */
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
  const heading = (row.closest("main") ?? document).querySelector<HTMLElement>(
    "h1, h2",
  );
  if (heading) {
    // -1 so the heading takes focus from a script without joining the tab order.
    heading.tabIndex = -1;
    heading.focus();
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
 * row goes, Clear all with it, so focus goes up to the filters, or to the
 * page's heading where nothing above the row takes focus.
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
