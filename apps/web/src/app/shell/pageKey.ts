import { useLocation } from "react-router";

/**
 * What makes two addresses the same page: the path alone. A query string
 * (a filter, a tab, a sort, the side peek) and a hash never make a new page,
 * and a trailing slash does not either. The page region is keyed by this, so
 * it is the whole rule for when a page change animates and when the page
 * keeps its place.
 */
export function pageKey(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

export function usePageKey(): string {
  return pageKey(useLocation().pathname);
}
