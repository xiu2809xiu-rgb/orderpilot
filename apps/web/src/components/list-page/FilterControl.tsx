import { ToggleChip } from "@/components/common/data-table/Field";
import type { TableFilters } from "@/components/common";
import { FilterLookup } from "./FilterLookup";
import { FilterRange } from "./FilterRange";
import { FilterSelect } from "./FilterSelect";
import type { ListFilter } from "./types";

interface FilterControlProps {
  filter: ListFilter;
  filters: TableFilters;
  setFilter: (id: string, value: string | boolean | undefined) => void;
  /** Labels above the fields, for the popover. */
  showLabel?: boolean;
}

/** One filter of the bar: a select, or a switch for a yes/no. */
export function FilterControl({
  filter,
  filters,
  setFilter,
  showLabel = false,
}: FilterControlProps) {
  if (filter.kind === "toggle") {
    return (
      <ToggleChip
        checked={filters[filter.id] === true}
        onCheckedChange={(checked) => {
          setFilter(filter.id, checked);
        }}
      >
        {filter.label}
      </ToggleChip>
    );
  }
  if (filter.kind === "range") {
    return (
      <FilterRange
        label={filter.label}
        id={filter.id}
        filters={filters}
        setFilter={setFilter}
        showLabel={showLabel}
      />
    );
  }
  const shared = {
    label: filter.label,
    allLabel: filter.allLabel ?? filter.label,
    value: String(filters[filter.id] ?? ""),
    options: filter.options ?? [],
    showLabel,
    onChange: (next: string | undefined) => {
      setFilter(filter.id, next);
    },
  };
  return filter.kind === "lookup" ? (
    <FilterLookup {...shared} />
  ) : (
    <FilterSelect {...shared} describe={filter.describe} />
  );
}
