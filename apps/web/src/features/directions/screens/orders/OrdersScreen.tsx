import { Inbox } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "@/components/common";
import { Pagination } from "@/components/common/data-table/Pagination";
import { useRowSelection } from "@/components/list-page/useRowSelection";
import { todayInSingapore } from "@/lib/format";
import { tableStatusOf } from "@/lib/query-status";
import { useSessionStore } from "@/stores/session";
import { SALES_STEP_IDS } from "../../data/estimates";
import { Alert, AlertDescription, AlertTitle } from "../../kit/Alert";
import { EmptyState } from "../../parts/EmptyState";
import { PageHeader } from "../../parts/PageHeader";
import { AppliedFilters } from "./AppliedFilters";
import { BoardState } from "./BoardState";
import { customersOf } from "./CustomerFilter";
import { OrderOperationLog } from "./OrderOperationLog";
import { OrderPeek } from "./OrderPeek";
import { orderColumns } from "./orderColumns";
import { OrdersActions } from "./OrdersActions";
import { OrdersBoard } from "./OrdersBoard";
import { OrdersFilters } from "./OrdersFilters";
import { OrdersTable } from "./OrdersTable";
import { OrdersToolbar } from "./OrdersToolbar";
import { OrdersViews } from "./OrdersViews";
import type { OrderRow } from "./orderRow";
import {
  countStages,
  countViews,
  filterOrders,
  PAGE_SIZES,
  sortOrders,
  type SortId,
} from "./ordersQuery";
import { useAppliedChips } from "./useAppliedChips";
import { useDirection } from "../../frame/useDirection";
import "./orders.css";
import { useOrderColumns } from "./useOrderColumns";
import { useOrdersQuery } from "./useOrdersQuery";
import { useOrderRows, LOADED } from "./useOrderRows";

const rowKey = (row: OrderRow) => row.orderNo;

/**
 * Orders: one workspace in place of the Orders page and the order tracker.
 * The views run across the top, the filters of both old pages sit under them,
 * and one table holds every order with its journey. A click on a row opens the
 * side peek; the number opens the order. The address carries every choice, so
 * a link from the home screen opens the list already filtered.
 */
export default function OrdersScreen() {
  const { t } = useTranslation("directions-orders");
  const { t: tc } = useTranslation("common");
  const direction = useDirection();
  const { query, change } = useOrdersQuery();
  const session = useSessionStore((state) => state.session);
  const who = useMemo(() => ({ role: session?.user.role }), [session]);
  const mayHaveTasks = session?.permissions.includes("tasks.complete") ?? false;
  const data = useOrderRows();
  const today = todayInSingapore();
  const [peekNo, setPeekNo] = useState<string | null>(null);

  const rowLabel = useCallback((row: OrderRow) => row.orderNo, []);

  const valueHidden = data.rows[0]?.amount.masked ?? false;
  const columns = useMemo(
    () =>
      orderColumns({
        t,
        roleLabel: (role) => tc(`roles.${role}`),
        direction,
        today,
        valueHidden,
      }),
    [t, tc, direction, today, valueHidden],
  );
  const table = useOrderColumns(columns);
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

  const start = (query.page - 1) * query.pageSize;
  const pageRows = filtered.slice(start, start + query.pageSize);
  const selection = useRowSelection(pageRows, rowKey, rowLabel);
  // The log of one order is shown when exactly one row is ticked.
  const only =
    selection.selected.length === 1 ? selection.selected[0] : undefined;
  const takeaway = selection.selected.length ? selection.selected : filtered;
  const late = data.rows.filter((row) => row.overdue?.overdue === true).length;

  const peekIndex = filtered.findIndex((row) => row.orderNo === peekNo);
  const peeked = peekIndex >= 0 ? (filtered[peekIndex] ?? null) : null;
  const status = tableStatusOf(data.orders);
  const empty = status === "ready" && data.rows.length === 0;

  const onSort = (id: SortId) => {
    const current = sort?.id === id ? sort : null;
    change({
      sort:
        current?.direction === "desc"
          ? null
          : { id, direction: current ? "desc" : "asc" },
    });
  };
  const showMine = mayHaveTasks;
  const view = query.view === "mine" && !showMine ? "all" : query.view;

  return (
    <div className="od-page py-6">
      <PageHeader
        title={t("title")}
        intro={
          status === "ready"
            ? t("intro", { count: data.total, late })
            : undefined
        }
        actions={<OrdersActions />}
      />
      {empty ? (
        <EmptyState
          icon={Inbox}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      ) : (
        <div className="od-work">
          <div className="od-top">
            <OrdersViews
              view={view}
              counts={counts}
              showMine={showMine}
              onChange={(next) => {
                change({ view: next });
              }}
            />
            <OrdersToolbar
              query={query}
              columns={table.arranged}
              shown={table.shown}
              visibleIds={table.visibleIds}
              prefs={table.prefs}
              rows={takeaway}
              ticked={selection.selected.length}
              onClearTicks={selection.clear}
              appliedWords={[
                ...(view === "all" ? [] : [t(`views.${view}`)]),
                ...chips.map((chip) => chip.label),
              ]}
              onApply={change}
            />
          </div>
          <OrdersFilters
            query={query}
            stageCounts={stageCounts}
            customers={customers}
            onChange={change}
          />
          <AppliedFilters chips={chips} onChange={change} />
          {data.trackerMissing ? (
            <Alert variant="warning">
              <AlertTitle>{t("notices.trackerTitle")}</AlertTitle>
              <AlertDescription>{t("notices.trackerBody")}</AlertDescription>
            </Alert>
          ) : null}
          {data.truncated ? (
            <Alert variant="info">
              <AlertTitle>
                {t("notices.truncated", { shown: LOADED, total: data.total })}
              </AlertTitle>
            </Alert>
          ) : null}
          <p role="status" className="sr-only">
            {status === "ready"
              ? t("table.showing", { count: filtered.length })
              : ""}
          </p>
          {view === "stage" && status !== "ready" ? (
            <BoardState
              status={status}
              error={data.error}
              onRetry={data.refetch}
            />
          ) : view === "stage" ? (
            <OrdersBoard
              rows={filtered}
              onPeek={setPeekNo}
              onOpenStep={(position) => {
                change({
                  view: "all",
                  step: SALES_STEP_IDS[position - 1] ?? null,
                });
              }}
            />
          ) : (
            <>
              <OrdersTable
                columns={table.shown}
                rows={pageRows}
                status={status}
                error={data.error}
                filtered={chips.length > 0 || query.search !== ""}
                sort={sort}
                selection={selection.table}
                peeked={peekNo}
                onSort={onSort}
                onPeek={setPeekNo}
                onRetry={data.refetch}
                onClearFilters={() => {
                  change({
                    search: "",
                    customer: null,
                    stage: "all",
                    status: null,
                    step: null,
                    overdue: false,
                    exceptions: false,
                    stock: false,
                    toConfirm: false,
                    open: false,
                    entry: null,
                    source: null,
                    from: null,
                    to: null,
                    view: "all",
                  });
                }}
              />
              {only ? <OrderOperationLog orderNo={only.orderNo} /> : null}
              <Pagination
                page={query.page}
                pageSize={query.pageSize}
                total={status === "ready" ? filtered.length : 0}
                pageSizes={PAGE_SIZES}
                onPage={(page) => {
                  change({ page });
                }}
                onPageSize={(pageSize) => {
                  change({ pageSize });
                }}
              />
            </>
          )}
        </div>
      )}
      <OrderPeek
        row={peeked}
        position={peekIndex + 1}
        total={filtered.length}
        roleLabel={(role) => tc(`roles.${role}`)}
        onStep={(delta) => {
          const next = filtered[peekIndex + delta];
          if (next) setPeekNo(next.orderNo);
        }}
        onClose={() => {
          setPeekNo(null);
        }}
      />
      <Toaster />
    </div>
  );
}
