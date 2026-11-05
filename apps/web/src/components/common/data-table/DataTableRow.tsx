import type { ComponentProps, MouseEvent } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { gestureOf, useOpenRecord } from "../useOpenRecord";
import { ACTIONS_CELL, cellClass } from "./cells";
import { firstSticky } from "./DataTableHead";
import { SelectCell } from "./SelectCells";
import {
  alignsEnd,
  type DataTableColumn,
  type RowActionsColumn,
  type TableSelection,
} from "./types";

type RowEvent = MouseEvent<HTMLTableRowElement>;

interface DataTableRowProps<Row> {
  row: Row;
  columns: readonly DataTableColumn<Row>[];
  onRowClick?: ((row: Row) => void) | undefined;
  /** Without a link for a row (it returns nothing), that row is not clickable. */
  rowHref?: ((row: Row) => string | undefined) | undefined;
  selection?: TableSelection<Row> | undefined;
  rowActions?: RowActionsColumn<Row> | undefined;
}

/**
 * True for a click on the row itself. A click on a link or a button in the row
 * is that control's own (a checkbox and the row menu are buttons), a popover's
 * clicks bubble here through its portal without being inside the row, and
 * dragging over text is copying.
 */
function opensRow(event: RowEvent): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  if (!event.currentTarget.contains(target)) return false;
  if (target.closest("a, button, input, select, label")) return false;
  return !window.getSelection()?.toString();
}

type CellsProps<Row> = Pick<
  DataTableRowProps<Row>,
  "row" | "columns" | "selection" | "rowActions"
> &
  ComponentProps<typeof TableRow>;

function Cells<Row>({
  row,
  columns,
  selection,
  rowActions,
  ...props
}: CellsProps<Row>) {
  const first = firstSticky(selection !== undefined);
  return (
    <TableRow
      {...props}
      data-selected={selection?.isSelected(row) ? "" : undefined}
    >
      {selection ? <SelectCell row={row} selection={selection} /> : null}
      {columns.map((column, position) => (
        <TableCell
          key={column.id}
          className={cellClass(column, position === 0 ? first : "none")}
          data-numeric={alignsEnd(column) ? "" : undefined}
        >
          {column.cell(row)}
        </TableCell>
      ))}
      {rowActions ? (
        <TableCell className={ACTIONS_CELL}>{rowActions.cell(row)}</TableCell>
      ) : null}
    </TableRow>
  );
}

/**
 * A row that opens a record page. It behaves like a `RecordLink`: a plain
 * click opens the record, and Ctrl+click, Command+click or a middle click
 * opens it in a background tab and stays on the list.
 */
function RecordRow<Row>({
  rowHref,
  ...props
}: DataTableRowProps<Row> & { rowHref: (row: Row) => string | undefined }) {
  const openRecord = useOpenRecord();
  const { row } = props;
  const href = rowHref(row);
  if (href === undefined) {
    return (
      <Cells
        {...props}
        className="group/row hover:bg-muted data-[selected]:bg-accent"
      />
    );
  }
  return (
    <Cells
      {...props}
      className="group/row cursor-pointer hover:bg-muted data-[selected]:bg-accent"
      onClick={(event: RowEvent) => {
        if (opensRow(event)) openRecord(href, gestureOf(event));
      }}
      onAuxClick={(event: RowEvent) => {
        if (event.button === 1 && opensRow(event)) {
          openRecord(href, "background");
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
  const { row, onRowClick, rowHref, ...rest } = props;
  if (rowHref) return <RecordRow row={row} rowHref={rowHref} {...rest} />;
  return (
    <Cells
      row={row}
      {...rest}
      className={cn(
        "group/row hover:bg-muted data-[selected]:bg-accent",
        onRowClick && "cursor-pointer",
      )}
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
