import type { FilterChip, TableFilters, TableQuery } from "@/components/common";
import type { ListFilter } from "./types";

/** The id the search term uses as a chip, which no filter may take. */
export const SEARCH_CHIP = "__search";

/**
 * The applied filters in words: "Brand: Quillon", "Overdue only", and the
 * search term. A value a link set that the options do not list shows as it is.
 */
export function appliedChips(
  filters: readonly ListFilter[],
  query: Pick<TableQuery, "search" | "filters">,
  searchLabel: string,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (query.search) {
    chips.push({ id: SEARCH_CHIP, label: `${searchLabel}: ${query.search}` });
  }
  for (const filter of filters) {
    const value = query.filters[filter.id];
    if (filter.kind === "toggle") {
      if (value === true) chips.push({ id: filter.id, label: filter.label });
    } else if (typeof value === "string" && value !== "") {
      const option = filter.options?.find((o) => o.value === value);
      chips.push({
        id: filter.id,
        label: `${filter.label}: ${option?.label ?? value}`,
      });
    }
  }
  return chips;
}

/** Chips with the search term mixed into the filters, as `FilterChips` wants them. */
export function withSearch(query: TableQuery): TableFilters {
  return query.search
    ? { ...query.filters, [SEARCH_CHIP]: query.search }
    : query.filters;
}

/** The query after a chip was cleared: the search term or a filter is gone. */
export function withoutChip(
  next: TableFilters,
): Pick<TableQuery, "search" | "filters"> {
  const { [SEARCH_CHIP]: search, ...filters } = next;
  return { search: typeof search === "string" ? search : "", filters };
}
