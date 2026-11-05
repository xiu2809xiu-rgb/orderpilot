import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SELECT_CELL } from "./cells";
import type { TableSelection } from "./types";

// The box is 16 px; on a touch screen its target grows to 44 px around it.
const BOX =
  "relative after:absolute after:-inset-2 after:content-[''] pointer-coarse:after:-inset-3.5";

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
        "top-0 z-20 h-9 shadow-[inset_0_-1px_0_var(--border)]",
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
