/** How many pages a list of `total` rows has at this page size. An empty list still has one page. */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/**
 * The page to open for a page number from an address: one past the end opens
 * the last page. Only a list that has rows is clamped, because while the
 * answer has not arrived there is no end to measure against.
 */
export function clampPage(
  page: number,
  total: number,
  pageSize: number,
): number {
  return Math.min(Math.max(1, page), pageCount(total, pageSize));
}
