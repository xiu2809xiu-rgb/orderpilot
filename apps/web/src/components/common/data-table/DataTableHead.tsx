import { TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { absorbedOnPhone, ACTIONS_CELL, type Sticky } from "./cells";
import { SelectHead } from "./SelectCells";
import { SortHeader } from "./SortHeader";
import type {
  DataTableColumn,
  RowActionsColumn,
  TableSelection,
  TableSort,
} from "./types";

interface DataTableHeadProps<Row> {
  columns: readonly DataTableColumn<Row>[];
  sort: TableSort | null;
  onSort: (columnId: string) => void;
  selection?: TableSelection<Row> | undefined;
  rowActions?: RowActionsColumn<Row> | undefined;
}

/** Where the first data column sticks: beside the checkboxes when there are some. */
export function firstSticky(selectable: boolean): Sticky {
  return selectable ? "afterSelect" : "start";
}

/** The heading row: the page's checkbox, the sortable columns, then the row menu's column. */
export function DataTableHead<Row>({
  columns,
  sort,
  onSort,
  selection,
  rowActions,
}: DataTableHeadProps<Row>) {
  const first = firstSticky(selection !== undefined);
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {selection ? <SelectHead selection={selection} /> : null}
        {columns.map((column, position) => (
          <SortHeader
            key={column.id}
            column={column}
            sort={sort}
            onSort={onSort}
            first={position === 0 ? first : "none"}
            className={absorbedOnPhone(position) ? "max-md:hidden" : undefined}
          />
        ))}
        {rowActions ? (
          <TableHead
            scope="col"
            className={`${ACTIONS_CELL} top-0 z-20 h-9 pointer-coarse:h-11 shadow-[inset_0_-1px_0_var(--border)]`}
          >
            <span className="sr-only">{rowActions.header}</span>
          </TableHead>
        ) : null}
      </TableRow>
    </TableHeader>
  );
}
