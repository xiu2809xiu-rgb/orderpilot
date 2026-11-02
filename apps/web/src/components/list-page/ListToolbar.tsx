import type {
  DataTableColumn,
  DataTableState,
  ExportOptions,
  TableQuery,
} from "@/components/common";
import { ActionBar } from "./ActionBar";
import { hasLeftActions } from "./actions";
import { AppliedFilters } from "./AppliedFilters";
import { appliedChips, withoutChip, withSearch } from "./chips";
import { FilterBar } from "./FilterBar";
import type { ListAction, ListFilter } from "./types";
import { ViewSettings } from "./ViewSettings";

interface ListToolbarProps<Row> {
  table: DataTableState<Row> & { rows: readonly Row[] };
  /** Every column, for the column settings. */
  columns: readonly DataTableColumn<Row>[];
  query: TableQuery;
  title: string;
  searchLabel: string;
  filters: readonly ListFilter[];
  /** Only the actions this role may use. */
  actions: readonly ListAction<Row>[];
  selection: readonly Row[];
  exportOptions?: ExportOptions<Row> | undefined;
  searchDebounceMs: number;
}

/**
 * Everything above the grid, top to bottom: the action bar, the filter bar and
 * the applied filters. A screen with no New, Edit, Void or batch action has
 * nothing for the first row, so its Import, Export and Print join the filter bar.
 */
export function ListToolbar<Row>({
  table,
  columns,
  query,
  title,
  searchLabel,
  filters,
  actions,
  selection,
  exportOptions,
  searchDebounceMs,
}: ListToolbarProps<Row>) {
  const { shown, rows, change, setFilter, prefs, visibleIds } = table;
  const chips = appliedChips(filters, query, searchLabel);
  const ownRow = hasLeftActions(actions);
  const bar = (
    <ActionBar
      actions={actions}
      selection={selection}
      title={title}
      filterWords={chips.map((chip) => chip.label)}
      columns={shown}
      rows={rows}
      exportOptions={exportOptions}
      compact={!ownRow}
    />
  );
  return (
    <div className="space-y-s2">
      {ownRow ? bar : null}
      <FilterBar
        filters={filters}
        values={query.filters}
        search={query.search}
        onSearch={(search) => {
          change({ search });
        }}
        setFilter={setFilter}
        searchDebounceMs={searchDebounceMs}
        trailing={
          <>
            <ViewSettings
              columns={columns}
              visibleIds={visibleIds}
              prefs={prefs}
              query={query}
              change={change}
            />
            {ownRow ? null : bar}
          </>
        }
      />
      <AppliedFilters
        chips={chips}
        filters={withSearch(query)}
        onChange={(next) => {
          change(withoutChip(next));
        }}
        onClearAll={() => {
          change({ search: "", filters: {} });
        }}
      />
    </div>
  );
}
