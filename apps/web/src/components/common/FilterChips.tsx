import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TableFilters } from "./data-table/types";
import "./data-table/data-table.css";

export interface FilterChip {
  /** The filter's key, removed from `filters` when the chip is cleared. */
  id: string;
  label: string;
}

/** The filters a link opened a list with, each with its own Clear button. */
export function FilterChips({
  chips,
  filters,
  onChange,
  clearAll,
}: {
  chips: readonly FilterChip[];
  filters: TableFilters;
  onChange: (filters: TableFilters) => void;
  /** Adds a last item that takes every chip off at once. */
  clearAll?: { label: string; onClear: () => void };
}) {
  const { t } = useTranslation("components");
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t("filterChips.label")} className="dt-applied">
      {chips.map((chip) => (
        <li key={chip.id} className="dt-chip">
          <span>{chip.label}</span>
          <button
            type="button"
            className="relative pointer-coarse:after:absolute pointer-coarse:after:-inset-2 pointer-coarse:after:content-['']"
            aria-label={t("filterChips.clear", { label: chip.label })}
            onClick={() => {
              const next = Object.fromEntries(
                Object.entries(filters).filter(([key]) => key !== chip.id),
              );
              onChange(next);
            }}
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </li>
      ))}
      {clearAll ? (
        <li>
          <button type="button" className="dt-clear" onClick={clearAll.onClear}>
            {clearAll.label}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
