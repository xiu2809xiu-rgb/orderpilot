import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DataTable,
  DemoBadge,
  PageHeader,
  usePrimaryAction,
  type DataTableColumn,
  type DemoBadgeKind,
  type ExportOptions,
  type TableQuery,
} from "@/components/common";
import { tableStatusOf } from "@/lib/query-status";
import { useSessionStore } from "@/stores/session";
import { ActionBar } from "./ActionBar";
import { labelOf, usableActions } from "./actions";
import { AppliedFilters } from "./AppliedFilters";
import { appliedChips, withoutChip, withSearch } from "./chips";
import { FilterBar } from "./FilterBar";
import { ViewSettings } from "./ViewSettings";
import type { ListAction, ListFilter, ListResult } from "./types";

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
  columns: readonly DataTableColumn<Row>[];
  rowKey: (row: Row) => string;
  /** The record page a row opens. The row then works like a `RecordLink`. */
  rowHref?: (row: Row) => string;
  onRowClick?: (row: Row) => void;
  /** From `useUrlQuery`: search, filters, sort, page and page size in the address. */
  query: TableQuery;
  onQueryChange: (query: TableQuery) => void;
  /** The generated query hook's result, as it comes. */
  list: ListResult<Row>;
  filters?: readonly ListFilter[];
  /** Every action the screen has. The template draws those the role may use. */
  actions?: readonly ListAction<Row>[];
  /** The ticked rows. P-45 brings the checkboxes; until then leave it out. */
  selection?: readonly Row[];
  /** Export and Print give every row the filter shows through `loadRows`. */
  exportOptions?: ExportOptions<Row>;
  empty?: { title?: string; description?: string; action?: ReactNode };
  partialNotice?: string;
  pageSizes?: readonly number[];
  searchDebounceMs?: number;
}

const NONE: readonly never[] = [];

/**
 * The page every list is built on: header, then the action bar and the filter
 * bar, then the grid. A screen declares its columns, filters and actions; the
 * template draws them, checks the role's permissions and keeps every state
 * (loading, empty, error with a trace id, permission denied, partial).
 */
export function ListPage<Row>({
  tableId,
  title,
  description,
  demo,
  tabs,
  caption,
  columns,
  rowKey,
  rowHref,
  onRowClick,
  query,
  onQueryChange,
  list,
  filters = NONE,
  actions = NONE,
  selection = NONE,
  exportOptions,
  empty,
  partialNotice,
  pageSizes,
  searchDebounceMs = 300,
}: ListPageProps<Row>) {
  const { t } = useTranslation("list-page");
  const session = useSessionStore((state) => state.session);
  const usable = usableActions(actions, session);
  const creating = usable.find((action) => action.kind === "new");
  // N starts the one primary action, wherever the New button is drawn.
  usePrimaryAction(
    creating
      ? {
          label: labelOf(creating, t),
          onRun: () => {
            creating.onRun?.(NONE);
          },
        }
      : undefined,
  );
  const chips = appliedChips(filters, query, t("filters.search"));

  return (
    <div className="space-y-s3">
      <PageHeader
        title={title}
        {...(description ? { description } : {})}
        {...(demo ? { meta: <DemoBadge kind={demo} /> } : {})}
        {...(list.data ? { total: list.data.meta.total } : {})}
      />
      {tabs}
      <DataTable
        tableId={tableId}
        caption={caption}
        columns={columns}
        rows={list.data?.data ?? NONE}
        total={list.data?.meta.total ?? 0}
        query={query}
        onQueryChange={onQueryChange}
        rowKey={rowKey}
        {...(rowHref ? { rowHref } : {})}
        {...(onRowClick ? { onRowClick } : {})}
        status={tableStatusOf(list)}
        error={list.error}
        onRetry={() => void list.refetch()}
        {...(partialNotice ? { partialNotice } : {})}
        {...(empty ? { empty } : {})}
        {...(pageSizes ? { pageSizes } : {})}
        toolbar={({ shown, rows, change, setFilter, prefs, visibleIds }) => (
          <div className="space-y-s2">
            <ActionBar
              actions={usable}
              selection={selection}
              title={title}
              filterWords={chips.map((chip) => chip.label)}
              columns={shown}
              rows={rows}
              exportOptions={exportOptions}
            />
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
                <ViewSettings
                  columns={columns}
                  visibleIds={visibleIds}
                  prefs={prefs}
                  query={query}
                  change={change}
                />
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
        )}
      />
    </div>
  );
}
