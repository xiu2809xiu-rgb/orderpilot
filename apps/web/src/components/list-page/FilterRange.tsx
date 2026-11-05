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
  const field = (key: string, word: string) => {
    const value = filters[key];
    return (
      <div className="flex items-center gap-1 text-sm">
        <label htmlFor={`${base}${key}`} className="text-muted-foreground">
          <span className="sr-only">{label} </span>
          {word}
        </label>
        <Input
          id={`${base}${key}`}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => {
            setFilter(key, event.target.value || undefined);
          }}
          className="h-9 w-40 tabular-nums pointer-coarse:h-11"
        />
      </div>
    );
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={showLabel ? "space-y-1" : "flex flex-wrap items-center gap-2"}
    >
      {showLabel ? (
        <span className="text-xs text-muted-foreground">{label}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {field(from, t("filters.from"))}
        {field(to, t("filters.to"))}
      </div>
    </div>
  );
}
