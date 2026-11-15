import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SELECT_CELL } from "./cells";
import type { TableSelection } from "./types";

// The box is 24 px (WCAG 2.2 AA target size). On a touch screen the button is
// a real 44 px square and the box is drawn inside it (`.dt-box` in
// data-table.css): an invisible layer around a 24 px button is clipped by the
// scrolling card and covered by the pinned cells beside it.
const BOX = "dt-box size-6 rounded-[5px]";

/** The heading of the checkbox column: one box that ticks or clears the page. */
export function SelectHead<Row>({
  selection,
}: {
  selection: TableSelection<Row>;
}) {
  const { t } = useTranslation("components");
  const { pageState } = selection;
  return (
    <TableHead
      scope="col"
      className={cn(
        SELECT_CELL,
        "top-0 z-20 h-9 pointer-coarse:h-11 shadow-[inset_0_-1px_0_var(--border)]",
      )}
    >
      <Checkbox
        aria-label={t("table.selectPage")}
        className={BOX}
        checked={
          pageState === "all"
            ? true
            : pageState === "some"
              ? "indeterminate"
              : false
        }
        onCheckedChange={selection.onTogglePage}
      />
    </TableHead>
  );
}

/** A row's box, named after the row: "Select SO-10001". */
export function SelectCell<Row>({
  row,
  selection,
}: {
  row: Row;
  selection: TableSelection<Row>;
}) {
  const { t } = useTranslation("components");
  return (
    <TableCell className={SELECT_CELL}>
      <Checkbox
        aria-label={t("table.selectRow", { row: selection.rowLabel(row) })}
        className={BOX}
        checked={selection.isSelected(row)}
        onCheckedChange={() => {
          selection.onToggle(row);
        }}
      />
    </TableCell>
  );
}
