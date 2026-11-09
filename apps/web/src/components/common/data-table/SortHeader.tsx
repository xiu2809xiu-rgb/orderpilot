import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { headClass, type Sticky } from "./cells";
import { alignsEnd, type DataTableColumn, type TableSort } from "./types";

interface SortHeaderProps<Row> {
  column: DataTableColumn<Row>;
  sort: TableSort | null;
  onSort: (columnId: string) => void;
  /** The first column stays in view when the table scrolls sideways. */
  first?: Sticky | boolean;
  className?: string | undefined;
}

/**
 * A column heading. A sortable one holds a button, and the heading carries
 * `aria-sort`, so a screen reader says "Customer, column header, sorted
 * ascending, button". It does not sort anything itself: it asks the page.
 */
export function SortHeader<Row>({
  column,
  sort,
  onSort,
  first = false,
  className,
}: SortHeaderProps<Row>) {
  const { t } = useTranslation("components");
  const active = sort?.columnId === column.id ? sort.direction : null;
  const ariaSort = active
    ? active === "asc"
      ? "ascending"
      : "descending"
    : column.sortable
      ? "none"
      : undefined;
  const Icon =
    active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <TableHead
      scope="col"
      aria-sort={ariaSort}
      className={cn(headClass(column, first), className)}
    >
      {column.sortable ? (
        <button
          type="button"
          onClick={() => {
            onSort(column.id);
          }}
          title={t("table.sortBy", { column: column.header })}
          className={cn(
            "relative -mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']",
            alignsEnd(column) && "flex-row-reverse",
          )}
        >
          {column.header}
          <Icon
            className={cn("size-3.5", !active && "text-muted-foreground")}
            aria-hidden="true"
          />
        </button>
      ) : (
        column.header
      )}
    </TableHead>
  );
}
