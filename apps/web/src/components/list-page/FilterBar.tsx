import type { ReactNode } from "react";
import { SearchBox } from "@/components/common/data-table/SearchBox";
import type { TableFilters } from "@/components/common";
import { FilterControl } from "./FilterControl";
import { MoreFilters } from "./MoreFilters";
import type { ListFilter } from "./types";

interface FilterBarProps {
  filters: readonly ListFilter[];
  values: TableFilters;
  search: string;
  onSearch: (search: string) => void;
  setFilter: (id: string, value: string | boolean | undefined) => void;
  searchDebounceMs: number;
  /** Saved filters and column settings, at the far end. */
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
  return (
    <div className="flex flex-wrap items-center gap-s1">
      <SearchBox
        value={search}
        onSearch={onSearch}
        debounceMs={searchDebounceMs}
      />
      {main.map((filter) => (
        <FilterControl
          key={filter.id}
          filter={filter}
          filters={values}
          setFilter={setFilter}
        />
      ))}
      <MoreFilters filters={more} values={values} setFilter={setFilter} />
      {trailing ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
