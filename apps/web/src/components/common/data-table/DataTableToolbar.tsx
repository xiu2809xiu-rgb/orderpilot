import type { ReactNode } from "react";
import { ColumnSettings } from "./ColumnSettings";
import { ExportMenu, type ExportOptions } from "./ExportMenu";
import { ToggleChip } from "./Field";
import { FilterPanel } from "./FilterPanel";
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

/**
 * Quick search and filters, each with its label in view, and at the far end
 * the saved views, the column settings and export.
 */
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
    <div className="dt-toolbar">
      <div className="dt-filters">
        <SearchBox
          value={query.search}
          onSearch={(search) => {
            change({ search });
          }}
          debounceMs={searchDebounceMs}
        />
        {filterSlot || toggleFilters.length > 0 ? (
          <FilterPanel active={Object.keys(query.filters).length}>
            {filterSlot?.({ filters: query.filters, setFilter })}
            {toggleFilters.length > 0 ? (
              <div className="dt-toggles">
                {toggleFilters.map((filter) => (
                  <ToggleChip
                    key={filter.id}
                    checked={query.filters[filter.id] === true}
                    onCheckedChange={(checked) => {
                      setFilter(filter.id, checked);
                    }}
                  >
                    {filter.label}
                  </ToggleChip>
                ))}
              </div>
            ) : null}
          </FilterPanel>
        ) : null}
      </div>
      <div className="dt-tools">
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
