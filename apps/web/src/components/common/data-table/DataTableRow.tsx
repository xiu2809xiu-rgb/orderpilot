import type { ComponentProps, MouseEvent } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { gestureOf, useOpenRecord } from "../useOpenRecord";
import { cellClass } from "./cells";
import { alignsEnd, type DataTableColumn } from "./types";

type RowEvent = MouseEvent<HTMLTableRowElement>;

interface DataTableRowProps<Row> {
  row: Row;
  columns: readonly DataTableColumn<Row>[];
  onRowClick?: ((row: Row) => void) | undefined;
  rowHref?: ((row: Row) => string) | undefined;
}

/**
 * True for a click on the row itself. A click on a link or a button in the row
 * is that control's own, a popover's clicks bubble here through its portal
 * without being inside the row, and dragging over text is copying.
 */
function opensRow(event: RowEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!event.currentTarget.contains(target)) return false;
  if (target.closest("a, button, input, select, label")) return false;
  return !window.getSelection()?.toString();
}

type CellsProps<Row> = Pick<DataTableRowProps<Row>, "row" | "columns"> &
  ComponentProps<typeof TableRow>;

function Cells<Row>({ row, columns, ...props }: CellsProps<Row>) {
  return (
    <TableRow {...props}>
      {columns.map((column, position) => (
        <TableCell
          key={column.id}
          className={cellClass(column, position === 0)}
          data-numeric={alignsEnd(column) ? "" : undefined}
        >
          {column.cell(row)}
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * A row that opens a record page. It behaves like a `RecordLink`: a plain
 * click opens the record, and Ctrl+click, Command+click or a middle click
 * opens it in a background tab and stays on the list.
 */
function RecordRow<Row>({
  row,
  columns,
  rowHref,
}: DataTableRowProps<Row> & { rowHref: (row: Row) => string }) {
  const openRecord = useOpenRecord();
  return (
    <Cells
      row={row}
      columns={columns}
      className="group/row cursor-pointer hover:bg-muted"
      onClick={(event: RowEvent) => {
        if (opensRow(event)) openRecord(rowHref(row), gestureOf(event));
      }}
      onAuxClick={(event: RowEvent) => {
        if (event.button === 1 && opensRow(event)) {
          openRecord(rowHref(row), "background");
        }
      }}
      onMouseDown={(event: RowEvent) => {
        // A middle press starts the browser's autoscroll on Windows; the click is ours.
        if (event.button === 1) event.preventDefault();
      }}
    />
  );
}

/** One row of data. Router hooks run only for a row that opens a record. */
export function DataTableRow<Row>(props: DataTableRowProps<Row>) {
  const { row, columns, onRowClick, rowHref } = props;
  if (rowHref) {
    return <RecordRow row={row} columns={columns} rowHref={rowHref} />;
  }
  return (
    <Cells
      row={row}
      columns={columns}
      className={cn("group/row hover:bg-muted", onRowClick && "cursor-pointer")}
      onClick={
        onRowClick
          ? (event: RowEvent) => {
              if (opensRow(event)) onRowClick(row);
            }
          : undefined
      }
    />
  );
}
