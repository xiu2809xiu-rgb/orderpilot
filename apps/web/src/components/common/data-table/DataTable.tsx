import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "@/components/ui/table";
import "./data-table.css";
import { ScrollRegion } from "../ScrollRegion";
import { PartialNotice } from "../states";
import { DataTableToolbar } from "./DataTableToolbar";
import { useDataTableState, type DataTableState } from "./useDataTableState";
import type { ExportOptions } from "./ExportMenu";
import { DataTableBody, type TableStatus } from "./DataTableBody";
import { DataTableHead } from "./DataTableHead";
import { Pagination } from "./Pagination";
import type {
  DataTableColumn,
  RowActionsColumn,
  TableFilters,
  TableQuery,
  TableSelection,
  ToggleFilter,
} from "./types";

export interface DataTableProps<Row> {
  /** Names this table's saved settings. Unique per table, for example "orders". */
  tableId: string;
  /** Names the table for screen readers. */
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  /** The rows of the current page, in the order the server sent them. */
  rows: readonly Row[];
  /** Rows across all pages that match the query. */
  total: number;
  query: TableQuery;
  /** Called with the next query for every change. The page fetches and passes new `rows`. */
  onQueryChange: (query: TableQuery) => void;
  rowKey: (row: Row) => string;
  /**
   * Opens the record when a row is clicked. Keep a link in the first column
   * as well: that is how a keyboard or a screen reader reaches the record.
   */
  onRowClick?: (row: Row) => void;
  /** The record page a row opens. The row then works like a `RecordLink`. */
  rowHref?: (row: Row) => string | undefined;
  status?: TableStatus;
  error?: unknown;
  onRetry?: () => void;
  /** Some data is missing. The table stays usable and says so. */
  partialNotice?: string;
  /** Yes/no filters shown as switches, such as "Show active only". */
  toggleFilters?: readonly ToggleFilter[];
  /** Any other filters: a picker, a date range. Change them with `setFilter`. */
  filterSlot?: (api: {
    filters: TableFilters;
    setFilter: (id: string, value: string | boolean | undefined) => void;
  }) => ReactNode;
  /**
   * Draws the controls above the table in place of the default toolbar. The
   * list page template puts its filter bar and action bar there.
   */
  toolbar?: (
    state: DataTableState<Row> & { rows: readonly Row[] },
  ) => ReactNode;
  empty?: { title?: string; description?: string; action?: ReactNode };
  /**
   * The applied-filter pills, drawn under the filter row and above the
   * card as the Orders workspace does. A page that draws its own
   * `FilterChips` above the table passes them here instead.
   */
  applied?: ReactNode;
  exportOptions?: ExportOptions<Row>;
  pageSizes?: readonly number[];
  searchDebounceMs?: number;
  /** Row checkboxes. The caller keeps what is ticked. */
  selection?: TableSelection<Row>;
  /** The last cell of every row, such as its row menu. */
  rowActions?: RowActionsColumn<Row>;
  /**
   * The card takes the height the page has left and scrolls inside it, as the
   * Orders workspace does. Only for a page whose own height is the screen's:
   * without it the card stops at 70% of the window.
   */
  fill?: boolean;
}

/**
 * The common data table. Paging, sorting, search and filters are the
 * server's: this component shows what it is given and reports what the viewer
 * asks for through `onQueryChange`. It never sorts or slices rows itself.
 */
export function DataTable<Row>({
  tableId,
  caption,
  columns,
  rows,
  total,
  query,
  onQueryChange,
  rowKey,
  onRowClick,
  rowHref,
  status = "ready",
  error,
  onRetry,
  partialNotice,
  toggleFilters = [],
  filterSlot,
  toolbar,
  empty,
  applied,
  exportOptions,
  pageSizes = [10, 25, 50],
  searchDebounceMs = 300,
  selection,
  rowActions,
  fill = false,
}: DataTableProps<Row>) {
  const { t } = useTranslation("components");
  const state = useDataTableState(tableId, columns, query, onQueryChange);
  const { shown, change, sortBy, sortNote, filtered } = state;

  return (
    <div className="dt" data-fill={fill ? "" : undefined}>
      {toolbar ? (
        toolbar({ ...state, rows })
      ) : (
        <DataTableToolbar
          columns={state.arranged}
          shown={shown}
          rows={rows}
          query={query}
          change={change}
          setFilter={state.setFilter}
          visibleIds={state.visibleIds}
          prefs={state.prefs}
          toggleFilters={toggleFilters}
          filterSlot={filterSlot}
          exportOptions={exportOptions}
          searchDebounceMs={searchDebounceMs}
        />
      )}

      {applied}

      {partialNotice ? (
        <PartialNotice description={partialNotice} onRetry={onRetry} />
      ) : null}

      <ScrollRegion
        label={t("table.region", { caption })}
        className="max-h-[min(70dvh,48rem)]"
      >
        <Table className="dt-table" aria-busy={status === "loading"}>
          <caption className="sr-only">{caption}</caption>
          <DataTableHead
            columns={shown}
            sort={query.sort}
            onSort={sortBy}
            selection={selection}
            rowActions={rowActions}
          />
          <DataTableBody
            columns={shown}
            rows={rows}
            rowKey={rowKey}
            status={status}
            pageSize={query.pageSize}
            onRowClick={onRowClick}
            rowHref={rowHref}
            error={error}
            onRetry={onRetry}
            empty={empty}
            filtered={filtered}
            onClearFilters={() => {
              change({ search: "", filters: {} });
            }}
            selection={selection}
            rowActions={rowActions}
          />
        </Table>
      </ScrollRegion>
      <p role="status" className="sr-only">
        {sortNote}
      </p>

      <Pagination
        page={query.page}
        pageSize={query.pageSize}
        total={status === "ready" ? total : 0}
        quiet={status !== "ready"}
        pageSizes={pageSizes}
        onPage={(page) => {
          onQueryChange({ ...query, page });
        }}
        onPageSize={(pageSize) => {
          change({ pageSize });
        }}
      />
    </div>
  );
}
