import type { ReactNode } from "react";
import { ColumnSettings } from "./ColumnSettings";
import { ExportMenu, type ExportOptions } from "./ExportMenu";
import { SavedViews } from "./SavedViews";
import { SearchBox } from "./SearchBox";
import type {
  DataTableColumn,
  TableFilters,
  TableQuery,
  ToggleFilter,
} from "./types";
import type { TablePrefs } from "./useTablePrefs";

interface DataTableToolbarProps<Row> {
  /** Every column, in the viewer's order. */
  columns: readonly DataTableColumn<Row>[];
  /** The columns on screen: what an export holds. */
  shown: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  query: TableQuery;
  /** Asks for a changed query, back on page 1. */
  change: (patch: Partial<TableQuery>) => void;
  setFilter: (id: string, value: string | boolean | undefined) => void;
  visibleIds: ReadonlySet<string>;
  prefs: TablePrefs;
  toggleFilters: readonly ToggleFilter[];
  filterSlot?: (api: {
    filters: TableFilters;
    setFilter: (id: string, value: string | boolean | undefined) => void;
  }) => ReactNode;
  exportOptions?: ExportOptions<Row>;
  searchDebounceMs: number;
}

/** Quick search, filters, saved views, column settings and export. */
export function DataTableToolbar<Row>({
  columns,
  shown,
  rows,
  query,
  change,
  setFilter,
  visibleIds,
  prefs,
  toggleFilters,
  filterSlot,
  exportOptions,
  searchDebounceMs,
}: DataTableToolbarProps<Row>) {
  return (
    <div className="flex flex-wrap items-center gap-s1">
      <SearchBox
        value={query.search}
        onSearch={(search) => {
          change({ search });
        }}
        debounceMs={searchDebounceMs}
      />
      {toggleFilters.map((filter) => (
        <label key={filter.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            role="switch"
            className="size-4 accent-primary"
            checked={query.filters[filter.id] === true}
            onChange={(event) => {
              setFilter(filter.id, event.target.checked);
            }}
          />
          {filter.label}
        </label>
      ))}
      {filterSlot?.({ filters: query.filters, setFilter })}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <SavedViews
          saved={prefs.saved}
          onApply={(view) => {
            change({
              search: view.search,
              filters: view.filters,
              sort: view.sort,
            });
            prefs.applyColumns(view);
          }}
          onSave={(name) => {
            prefs.saveView(name, query);
          }}
          onDelete={prefs.deleteView}
        />
        <ColumnSettings
          columns={columns}
          visible={visibleIds}
          onVisibleChange={(ids) => {
            prefs.setHidden(
              columns.filter((c) => !ids.includes(c.id)).map((c) => c.id),
            );
          }}
          onOrderChange={prefs.setOrder}
          onReset={prefs.resetColumns}
        />
        {exportOptions ? (
          <ExportMenu columns={shown} rows={rows} {...exportOptions} />
        ) : null}
      </div>
    </div>
  );
}
