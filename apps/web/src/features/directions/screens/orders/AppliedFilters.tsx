import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AppliedChip } from "./useAppliedChips";
import { NO_FILTERS, type OrdersQuery } from "./ordersQuery";

/** What is narrowing the list, each with a button that takes it off, and one that clears them all. */
export function AppliedFilters({
  chips,
  onChange,
}: {
  chips: readonly AppliedChip[];
  onChange: (patch: Partial<OrdersQuery>) => void;
}) {
  const { t } = useTranslation("directions-orders");
  if (chips.length === 0) return null;
  return (
    <ul className="od-applied" aria-label={t("applied.label")}>
      {chips.map((chip) => (
        <li key={chip.id}>
          <button
            type="button"
            className="od-chip fs-13"
            aria-label={t("applied.remove", { filter: chip.label })}
            onClick={() => {
              onChange(chip.clear);
            }}
          >
            {chip.label}
            <X aria-hidden="true" className="size-3.5" />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          className="od-clear fs-13"
          onClick={() => {
            onChange(NO_FILTERS);
          }}
        >
          {t("applied.clear")}
        </button>
      </li>
    </ul>
  );
}
