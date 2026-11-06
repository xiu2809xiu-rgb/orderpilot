import type { ReactNode } from "react";
import type {
  DataTableColumn,
  DemoBadgeKind,
  ExportOptions,
  TableQuery,
} from "@/components/common";
import type {
  ListAction,
  ListFilter,
  ListResult,
  LoadPage,
  OperationLogSpec,
} from "./types";

/** What a screen declares to get a list page. */
export interface ListPageProps<Row> {
  /** Names this table's saved settings. Unique per table. */
  tableId: string;
  title: string;
  description?: string;
  /** Which demo label sits beside the title. */
  demo?: DemoBadgeKind;
  /** Links between sibling lists, drawn between the header and the bar. */
  tabs?: ReactNode;
  /** Names the table for screen readers. */
  caption: string;
  /** 2 when the list sits under a page that already has its h1. */
  headingLevel?: 1 | 2;
  columns: readonly DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  /** Names a row for its checkbox and its menu, such as its number. Defaults to `rowKey`. */
  rowLabel?: (row: Row) => string;
  /** The record page a row opens. The row then works like a `RecordLink`, and its menu offers View. */
  rowHref?: (row: Row) => string | undefined;
  onRowClick?: (row: Row) => void;
  /** From `useUrlQuery`: search, filters, sort, page and page size in the address. */
  query: TableQuery;
  onQueryChange: (query: TableQuery) => void;
  /** The generated query hook's result, as it comes. */
  list: ListResult<Row>;
  /** False when the list's API cannot search, so no search box is drawn. */
  searchable?: boolean;
  /** Each id must also be in the `useUrlQuery` spec: development throws if one is not. */
  filters?: readonly ListFilter[];
  /** Every action the screen has. The template draws those the role may use. */
  actions?: readonly ListAction<Row>[];
  /** The selected record's operation log, in a panel at the foot. */
  operationLog?: OperationLogSpec<Row>;
  /** One page of every row the filter shows: Export collects them, Print streams them. */
  loadPage?: LoadPage<Row>;
  /** Without `loadPage` or `loadRows`, Export and Print use the rows on screen. */
  exportOptions?: ExportOptions<Row>;
  empty?: { title?: string; description?: string; action?: ReactNode };
  partialNotice?: string;
  pageSizes?: readonly number[];
  searchDebounceMs?: number;
}
