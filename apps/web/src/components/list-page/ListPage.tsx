import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  DataTable,
  DemoBadge,
  PageHeader,
  usePrimaryAction,
  type TableQuery,
} from "@/components/common";
import { tableStatusOf } from "@/lib/query-status";
import { useSessionStore } from "@/stores/session";
import {
  barActions,
  labelOf,
  needsSelection,
  rowMenuActions,
  usableActions,
} from "./actions";
import { assertFiltersInUrl } from "./filterIds";
import { exportsOf } from "./listExports";
import type { ListPageProps } from "./ListPageProps";
import { ListToolbar } from "./ListToolbar";
import { RecordLogPanel } from "./RecordLogPanel";
import { RowMenu } from "./RowMenu";
import { hasRowMenuItems } from "./rowMenuItems";
import { useListRun } from "./useListRun";
import { useRowSelection } from "./useRowSelection";

export type { ListPageProps };

const NONE: readonly never[] = [];

/**
 * The page every list is built on: header, then the action bar and the filter
 * bar, then the grid with its checkboxes and row menus, then the selected
 * record's operation log. A screen declares its columns, filters and actions;
 * the template draws them, checks the role's permissions and keeps every state
 * (loading, empty, error with a trace id, permission denied, partial).
 */
export function ListPage<Row>(props: ListPageProps<Row>) {
  const { tableId, title, query, onQueryChange, list, rowKey } = props;
  const { filters = NONE, actions = NONE, operationLog, loadPage } = props;
  const { t } = useTranslation("list-page");
  const session = useSessionStore((state) => state.session);
  if (import.meta.env.DEV) assertFiltersInUrl(filters, onQueryChange);
  const rows = list.data?.data ?? NONE;
  const rowLabel = props.rowLabel ?? rowKey;
  const selection = useRowSelection(rows, rowKey, rowLabel);
  const { run, dialog } = useListRun<Row>(selection.clear);
  const usable = usableActions(actions, session);
  const bar = barActions(usable);
  const inMenu = rowMenuActions(usable);
  const selectable = bar.some(needsSelection) || operationLog !== undefined;
  const { rowHref } = props;
  const withMenu =
    inMenu.length > 0 || rowHref !== undefined || hasRowMenuItems();
  const creating = bar.find((action) => action.kind === "new");
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
  const { clear } = selection;
  // Selecting is for the page on screen: a new page, search or sort clears it.
  const changeQuery = useCallback(
    (next: TableQuery) => {
      clear();
      onQueryChange(next);
    },
    [clear, onQueryChange],
  );
  const { exportOptions, pages } = exportsOf(
    tableId,
    loadPage,
    props.exportOptions,
  );

  return (
    <div className="space-y-s3">
      <PageHeader
        title={title}
        {...(props.headingLevel ? { headingLevel: props.headingLevel } : {})}
        {...(props.description ? { description: props.description } : {})}
        {...(props.demo ? { meta: <DemoBadge kind={props.demo} /> } : {})}
        {...(list.data ? { total: list.data.meta.total } : {})}
      />
      {props.tabs}
      <DataTable
        tableId={tableId}
        caption={props.caption}
        columns={props.columns}
        rows={rows}
        total={list.data?.meta.total ?? 0}
        query={query}
        onQueryChange={changeQuery}
        rowKey={rowKey}
        {...(rowHref ? { rowHref } : {})}
        {...(props.onRowClick ? { onRowClick: props.onRowClick } : {})}
        status={tableStatusOf(list)}
        error={list.error}
        onRetry={() => void list.refetch()}
        {...(props.partialNotice ? { partialNotice: props.partialNotice } : {})}
        {...(props.empty ? { empty: props.empty } : {})}
        {...(props.pageSizes ? { pageSizes: props.pageSizes } : {})}
        {...(selectable ? { selection: selection.table } : {})}
        {...(withMenu
          ? {
              rowActions: {
                header: t("rowMenu.column"),
                cell: (row: Row) => (
                  <RowMenu
                    row={row}
                    target={{
                      listId: tableId,
                      label: rowLabel(row),
                      href: rowHref?.(row),
                    }}
                    actions={inMenu}
                    onRun={(action, picked) => {
                      run(action, picked, false);
                    }}
                  />
                ),
              },
            }
          : {})}
        toolbar={(table) => (
          <ListToolbar
            table={table}
            query={query}
            title={title}
            searchLabel={t("filters.search")}
            searchable={props.searchable ?? true}
            filters={filters}
            actions={bar}
            selection={selection.selected}
            selectable={selectable}
            onClearSelection={selection.clear}
            onRun={(action, picked) => {
              run(action, picked, true);
            }}
            exportOptions={exportOptions}
            pages={pages}
            searchDebounceMs={props.searchDebounceMs ?? 300}
          />
        )}
      />
      {operationLog ? (
        <RecordLogPanel
          spec={operationLog}
          selected={selection.selected}
          rowLabel={rowLabel}
        />
      ) : null}
      {dialog}
    </div>
  );
}
