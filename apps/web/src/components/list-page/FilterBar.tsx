import type { ReactNode } from "react";
import { SearchBox } from "@/components/common/data-table/SearchBox";
import type { TableFilters } from "@/components/common";
import { FilterControl } from "./FilterControl";
import { FilterPanel } from "@/components/common/data-table/FilterPanel";
import { isApplied } from "./filterIds";
import { MoreFilters } from "./MoreFilters";
import type { ListFilter } from "./types";

interface FilterBarProps {
  filters: readonly ListFilter[];
  values: TableFilters;
  /** Undefined draws no search box, for a list whose API cannot search. */
  search: string | undefined;
  onSearch: (search: string) => void;
  setFilter: (id: string, value: string | boolean | undefined) => void;
  searchDebounceMs: number;
  /** Saved views and column settings, at the far end. */
  trailing?: ReactNode;
}

/**
 * Quick search first, then the filters that matter, then More filters for the
 * rest. The search box answers the / key.
 */
export function FilterBar({
  filters,
  values,
  search,
  onSearch,
  setFilter,
  searchDebounceMs,
  trailing,
}: FilterBarProps) {
  const main = filters.filter((filter) => !filter.more);
  const more = filters.filter((filter) => filter.more);
  // Fields first, then the yes or no chips and More filters, as the Orders bar.
  const fields = main.filter((filter) => filter.kind !== "toggle");
  const toggles = main.filter((filter) => filter.kind === "toggle");
  return (
    <div className="lp-filters">
      {search === undefined ? null : (
        <SearchBox
          value={search}
          onSearch={onSearch}
          debounceMs={searchDebounceMs}
        />
      )}
      {filters.length > 0 ? (
        <FilterPanel
          active={filters.filter((filter) => isApplied(filter, values)).length}
        >
          {fields.map((filter) => (
            <FilterControl
              key={filter.id}
              filter={filter}
              filters={values}
              setFilter={setFilter}
            />
          ))}
          {toggles.length > 0 || more.length > 0 ? (
            <div className="dt-toggles">
              {toggles.map((filter) => (
                <FilterControl
                  key={filter.id}
                  filter={filter}
                  filters={values}
                  setFilter={setFilter}
                />
              ))}
              <MoreFilters
                filters={more}
                values={values}
                setFilter={setFilter}
              />
            </div>
          ) : null}
        </FilterPanel>
      ) : null}
      {trailing ? (
        <div className="dt-tools lp-filters-end">{trailing}</div>
      ) : null}
    </div>
  );
}
