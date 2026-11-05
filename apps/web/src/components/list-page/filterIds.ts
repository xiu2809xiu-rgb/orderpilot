import { rangeIds, urlFilterIds, type TableFilters } from "@/components/common";
import type { ListFilter } from "./types";

/** The query keys a filter keeps its value in: a range keeps two. */
export function queryIdsOf(filter: ListFilter): readonly string[] {
  return filter.kind === "range" ? rangeIds(filter.id) : [filter.id];
}

/** Whether any of the filter's values is set. */
export function isApplied(filter: ListFilter, values: TableFilters): boolean {
  return queryIdsOf(filter).some((key) => {
    const value = values[key];
    return value !== undefined && value !== false && value !== "";
  });
}

/**
 * A filter that is drawn but missing from the list's `useUrlQuery` spec would
 * do nothing: the address drops its value. Say so while a developer is looking.
 * A list that keeps its query some other way is not checked.
 */
export function assertFiltersInUrl(
  filters: readonly ListFilter[],
  onQueryChange: unknown,
): void {
  const known = urlFilterIds(onQueryChange);
  if (!known) return;
  for (const filter of filters) {
    for (const key of queryIdsOf(filter)) {
      if (!known.has(key)) {
        throw new Error(
          `The "${filter.id}" filter is drawn but "${key}" is not in this list's useUrlQuery spec, so it would do nothing. Add it to the spec.`,
        );
      }
    }
  }
}
