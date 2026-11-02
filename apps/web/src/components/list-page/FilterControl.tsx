import { useId } from "react";
import { Switch } from "@/components/ui/switch";
import type { TableFilters } from "@/components/common";
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
  const switchId = useId();
  if (filter.kind === "toggle") {
    return (
      <div className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
        <Switch
          id={switchId}
          checked={filters[filter.id] === true}
          onCheckedChange={(checked) => {
            setFilter(filter.id, checked);
          }}
        />
        <label htmlFor={switchId}>{filter.label}</label>
      </div>
    );
  }
  return (
    <FilterSelect
      label={filter.label}
      allLabel={filter.allLabel ?? filter.label}
      value={String(filters[filter.id] ?? "")}
      options={filter.options ?? []}
      showLabel={showLabel}
      onChange={(next) => {
        setFilter(filter.id, next);
      }}
    />
  );
}
