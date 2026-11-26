/**
 * Slides a tab row sideways until the selected tab shows. A narrow screen
 * cannot hold all five tabs, so the row scrolls; an order opened on a tab named
 * in the address (the Versions tab, after a confirmation) would otherwise
 * show its panel with the selected tab out of sight. Only the row moves: the
 * page is never scrolled up or down, so a heading that took focus stays put.
 */
export function showSelectedTab(row: HTMLElement | null): void {
  const selected = row?.querySelector<HTMLElement>(
    '[role="tab"][aria-selected="true"]',
  );
  if (!row || !selected) return;
  const edge = row.getBoundingClientRect();
  const tab = selected.getBoundingClientRect();
  if (tab.left < edge.left) row.scrollLeft -= edge.left - tab.left;
  else if (tab.right > edge.right) row.scrollLeft += tab.right - edge.right;
}
