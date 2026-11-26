import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TableFilters } from "./data-table/types";
import { focusAfterClear, focusAfterClearAll } from "./pillFocus";
import { useLeavingChips } from "./useLeavingChips";
import "./data-table/data-table.css";
import "./chip.css";

export interface FilterChip {
  /** The filter's key, removed from `filters` when the chip is cleared. */
  id: string;
  label: string;
}

/**
 * The filters a link opened a list with, each with its own Clear button. A
 * cleared pill fades out where it stood and then leaves; the filter changes at
 * once, and focus moves to the next pill or to Clear all.
 */
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
  const { rows, done } = useLeavingChips(chips);
  if (rows.length === 0) return null;
  // With nothing left but ghosts the row is only a picture, so it is out of
  // the reading order and the tab order at once, Clear all with it.
  const going = rows.every((row) => row.leaving);
  return (
    <ul
      aria-label={t("filterChips.label")}
      className="dt-applied"
      aria-hidden={going || undefined}
      inert={going || undefined}
    >
      {rows.map(({ chip, leaving }) =>
        leaving ? (
          <li
            key={chip.id}
            className="dt-chip chip-leaving"
            data-leaving=""
            aria-hidden="true"
            inert
            onAnimationEnd={() => {
              done(chip.id);
            }}
          >
            <span className="chip-ghost-text" data-label={chip.label} />
            <button type="button" tabIndex={-1}>
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ) : (
          <li key={chip.id} className="dt-chip" data-chip="">
            <span>{chip.label}</span>
            <button
              type="button"
              aria-label={t("filterChips.clear", { label: chip.label })}
              onClick={(event) => {
                focusAfterClear(event.currentTarget.closest("li"));
                const next = Object.fromEntries(
                  Object.entries(filters).filter(([key]) => key !== chip.id),
                );
                onChange(next);
              }}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        ),
      )}
      {clearAll ? (
        <li>
          <button
            type="button"
            className="dt-clear"
            onClick={(event) => {
              focusAfterClearAll(event.currentTarget.closest("li"));
              clearAll.onClear();
            }}
          >
            {clearAll.label}
          </button>
        </li>
      ) : null}
    </ul>
  );
}
