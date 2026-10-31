import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Table, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollRegion } from "../ScrollRegion";
import { PartialNotice } from "../states";
import { DataTableToolbar } from "./DataTableToolbar";
import type { ExportOptions } from "./ExportMenu";
import { DataTableBody, type TableStatus } from "./DataTableBody";
import { Pagination } from "./Pagination";
import { SortHeader } from "./SortHeader";
import {
  type DataTableColumn,
  type TableFilters,
  type TableQuery,
  type ToggleFilter,
} from "./types";
import { useTablePrefs } from "./useTablePrefs";

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
  empty?: { title?: string; description?: string; action?: ReactNode };
  exportOptions?: ExportOptions<Row>;
  pageSizes?: readonly number[];
  searchDebounceMs?: number;
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
  status = "ready",
  error,
  onRetry,
  partialNotice,
  toggleFilters = [],
  filterSlot,
  empty,
  exportOptions,
  pageSizes = [10, 25, 50],
  searchDebounceMs = 300,
}: DataTableProps<Row>) {
  const { t } = useTranslation("components");
  const prefs = useTablePrefs(tableId);
  const [sortNote, setSortNote] = useState("");

  const visibleIds = useMemo(
    () =>
      new Set(
        prefs.hidden
          ? columns
              .filter((c) => !prefs.hidden?.includes(c.id))
              .map((c) => c.id)
          : columns.filter((c) => !c.defaultHidden).map((c) => c.id),
      ),
    [columns, prefs.hidden],
  );
  const shown = columns.filter(
    (column) => column.hideable === false || visibleIds.has(column.id),
  );

  // Any change to what is asked for goes back to the first page.
  const change = (patch: Partial<TableQuery>) => {
    onQueryChange({ ...query, page: 1, ...patch });
  };
  const setFilter = (id: string, value: string | boolean | undefined) => {
    const rest = Object.entries(query.filters).filter(([key]) => key !== id);
    const filters: TableFilters = Object.fromEntries(rest);
    if (value !== undefined && value !== false && value !== "") {
      filters[id] = value;
    }
    change({ filters });
  };
  const filtered = query.search !== "" || Object.keys(query.filters).length > 0;

  function sortBy(columnId: string) {
    const current = query.sort?.columnId === columnId ? query.sort : null;
    const header = columns.find((c) => c.id === columnId)?.header ?? columnId;
    if (current?.direction === "desc") {
      setSortNote("");
      change({ sort: null });
      return;
    }
    const direction = current ? "desc" : "asc";
    setSortNote(
      t(direction === "asc" ? "table.sortedAsc" : "table.sortedDesc", {
        column: header,
      }),
    );
    change({ sort: { columnId, direction } });
  }

  return (
    <div className="space-y-s2">
      <DataTableToolbar
        columns={columns}
        shown={shown}
        rows={rows}
        query={query}
        change={change}
        setFilter={setFilter}
        visibleIds={visibleIds}
        prefs={prefs}
        toggleFilters={toggleFilters}
        filterSlot={filterSlot}
        exportOptions={exportOptions}
        searchDebounceMs={searchDebounceMs}
      />

      {partialNotice ? (
        <PartialNotice description={partialNotice} onRetry={onRetry} />
      ) : null}

      <ScrollRegion label={t("table.region", { caption })}>
        <Table aria-busy={status === "loading"}>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {shown.map((column) => (
                <SortHeader
                  key={column.id}
                  column={column}
                  sort={query.sort}
                  onSort={sortBy}
                />
              ))}
            </TableRow>
          </TableHeader>
          <DataTableBody
            columns={shown}
            rows={rows}
            rowKey={rowKey}
            status={status}
            pageSize={query.pageSize}
            error={error}
            onRetry={onRetry}
            empty={empty}
            filtered={filtered}
            onClearFilters={() => {
              change({ search: "", filters: {} });
            }}
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
