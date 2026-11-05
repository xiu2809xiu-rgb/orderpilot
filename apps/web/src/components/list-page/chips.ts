import {
  rangeIds,
  type FilterChip,
  type TableFilters,
  type TableQuery,
} from "@/components/common";
import { formatDay } from "@/lib/format";
import type { ListFilter } from "./types";

/** The id the search term uses as a chip, which no filter may take. */
export const SEARCH_CHIP = "__search";

/** The words a range chip needs: "Order date from" and "Order date to". */
export interface RangeWords {
  from: (label: string) => string;
  to: (label: string) => string;
}

/**
 * The applied filters in words: "Brand: Quillon", "Overdue only", and the
 * search term. A value a link set that the options do not list is said by the
 * filter's `describe`, or shown as it is.
 * A range gives one chip for each end, so each can be cleared on its own.
 */
export function appliedChips(
  filters: readonly ListFilter[],
  query: Pick<TableQuery, "search" | "filters">,
  searchLabel: string,
  range: RangeWords,
): FilterChip[] {
  const chips: FilterChip[] = [];
  if (query.search) {
    chips.push({ id: SEARCH_CHIP, label: `${searchLabel}: ${query.search}` });
  }
  for (const filter of filters) {
    const value = query.filters[filter.id];
    if (filter.kind === "range") {
      const [from, to] = rangeIds(filter.id);
      for (const [key, words] of [
        [from, range.from(filter.label)],
        [to, range.to(filter.label)],
      ] as const) {
        const day = query.filters[key];
        if (typeof day === "string" && day !== "") {
          chips.push({ id: key, label: `${words}: ${formatDay(day)}` });
        }
      }
    } else if (filter.kind === "toggle") {
      if (value === true) chips.push({ id: filter.id, label: filter.label });
    } else if (typeof value === "string" && value !== "") {
      const option = filter.options?.find((o) => o.value === value);
      const words = option?.label ?? filter.describe?.(value) ?? value;
      chips.push({ id: filter.id, label: `${filter.label}: ${words}` });
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
