import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useRowSelection } from "@/components/list-page/useRowSelection";
import { todayInSingapore } from "@/lib/format";
import { clampPage } from "@/lib/paging";
import { tableStatusOf } from "@/lib/query-status";
import { useSessionStore } from "@/stores/session";
import { customersOf } from "./CustomerFilter";
import { orderColumns } from "./orderColumns";
import { fitColumns, useFit } from "./orderFit";
import type { OrderRow } from "./orderRow";
import {
  countStages,
  countViews,
  filterOrders,
  sortOrders,
  type SortId,
} from "./ordersQuery";
import { useAppliedChips } from "./useAppliedChips";
import { useOrderColumns } from "./useOrderColumns";
import { useOrderRows } from "./useOrderRows";
import { useOrdersQuery } from "./useOrdersQuery";

const rowKey = (row: OrderRow) => row.orderNo;
const rowLabel = (row: OrderRow) => row.orderNo;

/**
 * Everything the Orders screen works out from the address and the API: the
 * rows in view and on the page, the counts of the views and stages, the
 * filters in words, the columns and the ticked rows. It is a hook so the
 * screen draws and this decides.
 */
export function useOrdersWorkspace() {
  const { t } = useTranslation("directions-orders");
  const { t: tc } = useTranslation("common");
  const { query, change } = useOrdersQuery();
  const session = useSessionStore((state) => state.session);
  const who = useMemo(() => ({ role: session?.user.role }), [session]);
  // Needs me is the team's own orders, so a role with no tasks has none.
  const showMine = session?.permissions.includes("tasks.complete") ?? false;
  const data = useOrderRows();
  const today = todayInSingapore();

  const valueHidden = data.rows[0]?.amount.masked ?? false;
  const fit = useFit();
  const columns = useMemo(
    () =>
      orderColumns({
        t,
        roleLabel: (role) => tc(`roles.${role}`),
        today,
        valueHidden,
        showStock: query.stock,
        fit,
      }),
    [t, tc, today, valueHidden, query.stock, fit],
  );
  const table = useOrderColumns(columns);
  // What the window has room for. The Columns control and the export still
  // work from the viewer's own choice, so a file does not depend on the window.
  const fitted = useMemo(
    () => fitColumns(table.shown, fit),
    [table.shown, fit],
  );
  // A role that may not see values cannot sort by them, whatever the address says.
  const sort = valueHidden && query.sort?.id === "amount" ? null : query.sort;

  const filtered = useMemo(
    () => sortOrders(filterOrders(data.rows, query, who), sort),
    [data.rows, query, who, sort],
  );
  const counts = useMemo(
    () => countViews(data.rows, query, who),
    [data.rows, query, who],
  );
  const stageCounts = useMemo(
    () => countStages(data.rows, query, who),
    [data.rows, query, who],
  );
  const customers = useMemo(() => customersOf(data.rows), [data.rows]);
  const chips = useAppliedChips(query, customers);

  // A page number past the end (`?page=99`) opens the last page, and the
  // address is rewritten so that a reload stays there. It waits for the list:
  // before the rows arrive there is no end to measure against.
  const status = tableStatusOf(data.orders);
  const ready = status === "ready";
  const page = ready
    ? clampPage(query.page, filtered.length, query.pageSize)
    : query.page;
  useEffect(() => {
    if (ready && page !== query.page) change({ page });
  }, [ready, page, query.page, change]);
  const start = (page - 1) * query.pageSize;
  const pageRows = filtered.slice(start, start + query.pageSize);
  const selection = useRowSelection(pageRows, rowKey, rowLabel);

  const onSort = useCallback(
    (id: SortId) => {
      const current = sort?.id === id ? sort : null;
      change({
        sort:
          current?.direction === "desc"
            ? null
            : { id, direction: current ? "desc" : "asc" },
      });
    },
    [sort, change],
  );

  return {
    query,
    change,
    data,
    status,
    /** The page in view: the address's page, or the last one when it names one past the end. */
    page,
    table,
    fit,
    fitted,
    sort,
    onSort,
    filtered,
    pageRows,
    counts,
    stageCounts,
    customers,
    chips,
    selection,
    showMine,
    /** The view in force: Needs me falls back to All for a role with no tasks. */
    view: query.view === "mine" && !showMine ? ("all" as const) : query.view,
    /** Past due, over every order, for the line under the title. */
    late: data.rows.filter((row) => row.overdue?.overdue === true).length,
  };
}

export type OrdersWorkspace = ReturnType<typeof useOrdersWorkspace>;
