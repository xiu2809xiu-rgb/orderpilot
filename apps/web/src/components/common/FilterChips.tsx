import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TableFilters } from "./data-table/types";

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
}: {
  chips: readonly FilterChip[];
  filters: TableFilters;
  onChange: (filters: TableFilters) => void;
}) {
  const { t } = useTranslation("components");
  if (chips.length === 0) return null;
  return (
    <ul aria-label={t("filterChips.label")} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li
          key={chip.id}
          className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent py-0.5 pr-0.5 pl-3 text-sm text-accent-foreground"
        >
          <span>{chip.label}</span>
          <button
            type="button"
            aria-label={t("filterChips.clear", { label: chip.label })}
            className="grid size-7 shrink-0 place-items-center rounded-full hover:bg-background/60 focus-visible:outline-2 focus-visible:outline-ring"
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
    </ul>
  );
}
