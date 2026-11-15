import { useTranslation } from "react-i18next";
import { FilterChips, type FilterChip } from "@/components/common";
import type { TableFilters } from "@/components/common";

interface AppliedFiltersProps {
  chips: readonly FilterChip[];
  filters: TableFilters;
  onChange: (filters: TableFilters) => void;
  onClearAll: () => void;
}

/** What is filtering the list, each with its own Clear, and Clear all. */
export function AppliedFilters({
  chips,
  filters,
  onChange,
  onClearAll,
}: AppliedFiltersProps) {
  const { t } = useTranslation("list-page");
  return (
    <FilterChips
      chips={chips}
      filters={filters}
      onChange={onChange}
      clearAll={{ label: t("filters.clearAll"), onClear: onClearAll }}
    />
  );
}
