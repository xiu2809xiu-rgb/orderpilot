import { useTranslation } from "react-i18next";
import type {
  DataTableState,
  ExportOptions,
  TableQuery,
} from "@/components/common";
import type { RowPage } from "@/components/common/data-table/useUrlQuery";
import { ActionBar } from "./ActionBar";
import { hasLeftActions } from "./actions";
import { AppliedFilters } from "./AppliedFilters";
import { appliedChips, withoutChip, withSearch } from "./chips";
import { FilterBar } from "./FilterBar";
import type { ListAction, ListFilter } from "./types";
import { ViewSettings } from "./ViewSettings";

interface ListToolbarProps<Row> {
  table: DataTableState<Row> & { rows: readonly Row[] };
  query: TableQuery;
  title: string;
  searchLabel: string;
  /** False when the list's API cannot search: no search box is drawn. */
  searchable: boolean;
  filters: readonly ListFilter[];
  /** Only the bar's actions this role may use. */
  actions: readonly ListAction<Row>[];
  selection: readonly Row[];
  selectable: boolean;
  onClearSelection: () => void;
  onRun: (action: ListAction<Row>, rows: readonly Row[]) => void;
  exportOptions?: ExportOptions<Row> | undefined;
  pages?: (() => AsyncIterable<RowPage<Row>>) | undefined;
  searchDebounceMs: number;
}

/**
 * Everything above the grid, top to bottom: the action bar, the filter bar and
 * the applied filters. A screen with no New, Edit, Void or batch action has
 * nothing for the first row, so its Import, Export and Print join the filter bar.
 */
export function ListToolbar<Row>({
  table,
  query,
  title,
  searchLabel,
  searchable,
  filters,
  actions,
  selection,
  selectable,
  onClearSelection,
  onRun,
  exportOptions,
  pages,
  searchDebounceMs,
}: ListToolbarProps<Row>) {
  const { t } = useTranslation("list-page");
  const { shown, arranged, rows, change, setFilter, prefs, visibleIds } = table;
  const chips = appliedChips(filters, query, searchLabel, {
    from: (label) => t("filters.rangeFrom", { label }),
    to: (label) => t("filters.rangeTo", { label }),
  });
  const ownRow = hasLeftActions(actions);
  const bar = (
    <ActionBar
      actions={actions}
      selection={selection}
      selectable={selectable}
      onClearSelection={onClearSelection}
      onRun={onRun}
      title={title}
      filterWords={chips.map((chip) => chip.label)}
      columns={shown}
      rows={rows}
      exportOptions={exportOptions}
      pages={pages}
      compact={!ownRow}
    />
  );
  return (
    <div className="space-y-s2">
      {ownRow ? bar : null}
      <FilterBar
        filters={filters}
        values={query.filters}
        search={searchable ? query.search : undefined}
        onSearch={(search) => {
          change({ search });
        }}
        setFilter={setFilter}
        searchDebounceMs={searchDebounceMs}
        trailing={
          <>
            <ViewSettings
              columns={arranged}
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
