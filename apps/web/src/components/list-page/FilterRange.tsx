import { useId } from "react";
import { useTranslation } from "react-i18next";
import { rangeIds, type TableFilters } from "@/components/common";
import { Input } from "@/components/ui/input";

interface FilterRangeProps {
  label: string;
  /** The range's id: it keeps `idFrom` and `idTo`. */
  id: string;
  filters: TableFilters;
  setFilter: (id: string, value: string | undefined) => void;
  showLabel?: boolean;
}

/** Two dates, "from" and "to", each a plain date field the keyboard and a touch screen both know. */
export function FilterRange({
  label,
  id,
  filters,
  setFilter,
  showLabel = false,
}: FilterRangeProps) {
  const { t } = useTranslation("list-page");
  const base = useId();
  const [from, to] = rangeIds(id);
  // The word names the field to the eye and the screen reader alike: in the bar
  // it says which range, and in the popover the group's own heading does.
  const field = (key: string, word: string) => {
    const value = filters[key];
    return (
      <div className="dt-field">
        <label htmlFor={`${base}${key}`} className="dt-field-label">
          {word}
        </label>
        <Input
          id={`${base}${key}`}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            setFilter(key, event.target.value || undefined);
          }}
          className="dt-control w-40 tabular-nums"
        />
      </div>
    );
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={showLabel ? "dt-field" : undefined}
    >
      {showLabel ? <span className="dt-field-label">{label}</span> : null}
      <div className="dt-range">
        {field(
          from,
          showLabel ? t("filters.from") : t("filters.rangeFrom", { label }),
        )}
        {field(
          to,
          showLabel ? t("filters.to") : t("filters.rangeTo", { label }),
        )}
      </div>
    </div>
  );
}
