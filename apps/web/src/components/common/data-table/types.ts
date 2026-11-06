import type { ReactNode } from "react";

export type SortDirection = "asc" | "desc";

export interface TableSort {
  columnId: string;
  direction: SortDirection;
}

/** Filter values: a text for a picker, a boolean for a switch such as "show active only". */
export type TableFilters = Record<string, string | boolean>;

/**
 * Everything the server needs to answer for one view of a table. The table
 * holds none of it: the page keeps this in its state (or the URL), passes it
 * back in, and fetches the matching rows. Pages count from 1.
 */
export interface TableQuery {
  page: number;
  pageSize: number;
  sort: TableSort | null;
  search: string;
  filters: TableFilters;
}

export const DEFAULT_QUERY: TableQuery = {
  page: 1,
  pageSize: 10,
  sort: null,
  search: "",
  filters: {},
};

export type ExportValue = string | number | boolean | null | undefined;

/**
 * What a column holds. Number and money columns sit on the right in tabular
 * figures; date columns stay on one line. Text is the default.
 */
export type ColumnKind = "text" | "number" | "money" | "date";

export interface DataTableColumn<Row> {
  /** Sent to the server as the sort column. */
  id: string;
  /** Plain text: the column title, the sort button and the export header. */
  header: string;
  cell: (row: Row) => ReactNode;
  /** The value in an export. Without it the column is left out of exports. */
  exportValue?: (row: Row) => ExportValue;
  sortable?: boolean;
  /** False keeps the column on screen, such as the record number. */
  hideable?: boolean;
  defaultHidden?: boolean;
  /** The kind of value. It sets the side and the figures; `align` overrides the side. */
  kind?: ColumnKind;
  /**
   * Long text that may run over several lines, such as a summary. Every other
   * column stays on one line, so rows stay compact and the table scrolls
   * inside its own container when the screen is narrow.
   */
  wrap?: boolean;
  align?: "start" | "end";
}

/** True when the column sits on the right: numbers and money, or an explicit `align`. */
export function alignsEnd(
  column: Pick<DataTableColumn<unknown>, "kind" | "align">,
): boolean {
  if (column.align) return column.align === "end";
  return column.kind === "number" || column.kind === "money";
}

/** A yes/no filter shown as a switch, such as "Show active only". */
export interface ToggleFilter {
  id: string;
  label: string;
}

/**
 * A saved view: a named search, filters and sort, and the columns as they were
 * shown and ordered, kept on this device for one viewer. A view saved before
 * columns were kept has no `hidden` or `order`, and leaves the columns alone.
 */
export interface SavedView {
  id: string;
  name: string;
  search: string;
  filters: TableFilters;
  sort: TableSort | null;
  hidden?: string[] | null | undefined;
  order?: string[] | null | undefined;
}

/**
 * Row checkboxes. The table draws them and reports each tick; whoever passes
 * this keeps what is ticked (the list page template does).
 */
export interface TableSelection<Row> {
  isSelected: (row: Row) => boolean;
  onToggle: (row: Row) => void;
  /** Ticks every row on the page, or clears them all when every one is ticked. */
  onTogglePage: () => void;
  /** How many of the page's rows are ticked, for the box in the heading. */
  pageState: "all" | "some" | "none";
  /** Names a row for its box, such as "SO-10001": "Select SO-10001". */
  rowLabel: (row: Row) => string;
}

/** The last cell of every row, such as its row menu, under a heading screen readers hear. */
export interface RowActionsColumn<Row> {
  header: string;
  cell: (row: Row) => ReactNode;
}
