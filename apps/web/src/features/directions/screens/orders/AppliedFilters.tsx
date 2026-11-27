import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  focusAfterClear,
  focusAfterClearAll,
} from "@/components/common/pillFocus";
import { useLeavingChips } from "@/components/common/useLeavingChips";
import type { AppliedChip } from "./useAppliedChips";
import { NO_FILTERS, type OrdersQuery } from "./ordersQuery";

/**
 * What is narrowing the list, each with a button that takes it off, and one
 * that clears them all. A cleared pill fades out where it stood and then
 * leaves: the list changes at once, and focus moves to the next pill or to
 * Clear all.
 */
export function AppliedFilters({
  chips,
  onChange,
}: {
  chips: readonly AppliedChip[];
  onChange: (patch: Partial<OrdersQuery>) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const { rows, done } = useLeavingChips(chips);
  if (rows.length === 0) return null;
  // With nothing left but ghosts the row is only a picture, so it is out of
  // the reading order and the tab order at once, Clear all with it.
  const going = rows.every((row) => row.leaving);
  return (
    <ul
      className="od-applied"
      aria-label={t("applied.label")}
      aria-hidden={going || undefined}
      inert={going || undefined}
    >
      {rows.map(({ chip, leaving }) =>
        leaving ? (
          <li
            key={chip.id}
            className="chip-leaving"
            data-leaving=""
            aria-hidden="true"
            inert
            onAnimationEnd={() => {
              done(chip.id);
            }}
          >
            <span className="od-chip fs-14">
              <span className="chip-ghost-text" data-label={chip.label} />
              <X aria-hidden="true" className="size-3.5" />
            </span>
          </li>
        ) : (
          <li key={chip.id} data-chip="">
            <button
              type="button"
              className="od-chip fs-14"
              aria-label={t("applied.remove", { filter: chip.label })}
              onClick={(event) => {
                focusAfterClear(event.currentTarget.closest("li"));
                onChange(chip.clear);
              }}
            >
              {chip.label}
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        ),
      )}
      <li>
        <button
          type="button"
          className="od-clear fs-14"
          onClick={(event) => {
            focusAfterClearAll(event.currentTarget.closest("li"));
            onChange(NO_FILTERS);
          }}
        >
          {t("applied.clear")}
        </button>
      </li>
    </ul>
  );
}
