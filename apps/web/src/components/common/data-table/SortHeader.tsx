import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DataTableColumn, TableSort } from "./types";

interface SortHeaderProps<Row> {
  column: DataTableColumn<Row>;
  sort: TableSort | null;
  onSort: (columnId: string) => void;
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
      className={cn(column.align === "end" && "text-right")}
    >
      {column.sortable ? (
        <button
          type="button"
          onClick={() => {
            onSort(column.id);
          }}
          title={t("table.sortBy", { column: column.header })}
          className={cn(
            "-mx-1 inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
            column.align === "end" && "flex-row-reverse",
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
