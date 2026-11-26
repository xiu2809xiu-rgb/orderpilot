import { ListFilter } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { CountBadge } from "../CountBadge";
import "./data-table.css";

/**
 * The filters under the search. On a wide screen they are simply there, in
 * the row. On a phone they would fill the screen before the first row, so
 * they sit behind a Filters button that says how many are on, and the search
 * stays in view. The wrapper draws as nothing on a wide screen, so the layout
 * there is the filters' own.
 */
export function FilterPanel({
  active,
  children,
}: {
  /** How many filters are in force, so a closed panel still tells. */
  active: number;
  children: ReactNode;
}) {
  const { t } = useTranslation("components");
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="dt-control dt-panel-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen((now) => !now);
        }}
      >
        <ListFilter aria-hidden="true" />
        {t("table.filters")}
        <CountBadge
          count={active}
          className="lp-count"
          label={t("table.filtersOn", { count: active })}
        />
      </Button>
      <div id={id} className="dt-panel" data-open={open}>
        {children}
      </div>
    </>
  );
}
