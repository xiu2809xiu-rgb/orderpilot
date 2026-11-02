import { useTranslation } from "react-i18next";
import { FilterChips, type FilterChip } from "@/components/common";
import type { TableFilters } from "@/components/common";
import { Button } from "@/components/ui/button";

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
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterChips chips={chips} filters={filters} onChange={onChange} />
      <Button
        variant="ghost"
        size="sm"
        className="pointer-coarse:h-11"
        onClick={onClearAll}
      >
        {t("filters.clearAll")}
      </Button>
    </div>
  );
}
