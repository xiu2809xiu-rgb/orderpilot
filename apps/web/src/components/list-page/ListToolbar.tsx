import type { ReactNode } from "react";
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
  /** Sibling views (links or tabs), on the top row beside the tools. */
  tabs?: ReactNode;
}

/**
 * Everything above the grid, top to bottom, as the Orders workspace draws it:
 * a top row (sibling views on the left, the actions and view tools on the
 * right), the filter bar with a label above every field, and the applied
 * filters. A screen with no views and no Edit, Void or batch action has
 * nothing for the left of the top row, so its tools join the filter bar.
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
  tabs,
}: ListToolbarProps<Row>) {
  const { t } = useTranslation("list-page");
  const { shown, arranged, rows, change, setFilter, prefs, visibleIds } = table;
  const chips = appliedChips(filters, query, searchLabel, {
    from: (label) => t("filters.rangeFrom", { label }),
    to: (label) => t("filters.rangeTo", { label }),
  });
  const tools = (
    <ViewSettings
      columns={arranged}
      visibleIds={visibleIds}
      prefs={prefs}
      query={query}
      change={change}
    />
  );
  const ownRow = tabs !== undefined || hasLeftActions(actions);
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
      tools={ownRow ? tools : undefined}
    />
  );
  return (
    <div className="lp-toolbar">
      {ownRow ? (
        <div className="lp-top">
          {tabs}
          {bar}
        </div>
      ) : null}
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
          ownRow ? null : (
            <>
              {tools}
              {bar}
            </>
          )
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
