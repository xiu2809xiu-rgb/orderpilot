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
  align?: "start" | "end";
}

/** A yes/no filter shown as a switch, such as "Show active only". */
export interface ToggleFilter {
  id: string;
  label: string;
}

/** A named set of search, filters and sort, kept on this device for one viewer. */
export interface SavedFilter {
  id: string;
  name: string;
  search: string;
  filters: TableFilters;
  sort: TableSort | null;
}
