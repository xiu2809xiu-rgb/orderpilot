import { useTranslation } from "react-i18next";
import { DemoBadge } from "@/components/common/DemoBadge";
import { Pagination } from "@/components/common/data-table/Pagination";
import { SALES_STEP_IDS } from "../../data/estimates";
import { Alert, AlertDescription, AlertTitle } from "@/components/kit/Alert";
import { AppliedFilters } from "./AppliedFilters";
import { BoardState } from "./BoardState";
import { OrderOperationLog } from "./OrderOperationLog";
import { OrdersBoard } from "./OrdersBoard";
import { OrdersFilters } from "./OrdersFilters";
import { OrdersTable } from "./OrdersTable";
import { OrdersToolbar } from "./OrdersToolbar";
import { OrdersViews } from "./OrdersViews";
import { NO_FILTERS, PAGE_SIZES } from "./ordersQuery";
import { LOADED } from "./useOrderRows";
import type { OrdersWorkspace as Workspace } from "./useOrdersWorkspace";

/**
 * The workspace under the title: the views and the toolbar, the filters and
 * what is in force, the notices, and then the table or the board. It draws
 * what the hook worked out and decides nothing of its own.
 */
export function OrdersWorkspace({
  w,
  peeked,
  onPeek,
}: {
  w: Workspace;
  peeked: string | null;
  onPeek: (orderNo: string) => void;
}) {
  const { t } = useTranslation("directions-orders");
  const { query, change, data, status, view } = w;
  // The log of one order is shown when exactly one row is ticked.
  const only =
    w.selection.selected.length === 1 ? w.selection.selected[0] : undefined;
  const takeaway = w.selection.selected.length
    ? w.selection.selected
    : w.filtered;
  return (
    <div className="od-work">
      <div className="od-top">
        <OrdersViews
          view={view}
          counts={w.counts}
          showMine={w.showMine}
          onChange={(next) => {
            change({ view: next });
          }}
        />
        <OrdersToolbar
          query={query}
          columns={w.table.arranged}
          shown={w.table.shown}
          visibleIds={w.table.visibleIds}
          prefs={w.table.prefs}
          rows={takeaway}
          ticked={w.selection.selected.length}
          ready={status === "ready"}
          onClearTicks={w.selection.clear}
          appliedWords={[
            ...(view === "all" ? [] : [t(`views.${view}`)]),
            ...w.chips.map((chip) => chip.label),
          ]}
          onApply={change}
        />
      </div>
      <OrdersFilters
        query={query}
        stageCounts={w.stageCounts}
        customers={w.customers}
        active={w.chips.length}
        onChange={change}
      />
      <AppliedFilters chips={w.chips} onChange={change} />
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
          ? t("table.showing", { count: w.filtered.length })
          : ""}
      </p>
      {view === "stage" && status !== "ready" ? (
        <BoardState status={status} error={data.error} onRetry={data.refetch} />
      ) : view === "stage" ? (
        <OrdersBoard
          rows={w.filtered}
          onPeek={onPeek}
          onOpenStep={(position) => {
            change({ view: "all", step: SALES_STEP_IDS[position - 1] ?? null });
          }}
        />
      ) : (
        <>
          <OrdersTable
            columns={w.table.shown}
            rows={w.pageRows}
            status={status}
            error={data.error}
            filtered={
              w.chips.length > 0 || query.search !== "" || view !== "all"
            }
            sort={w.sort}
            selection={w.selection.table}
            peeked={peeked}
            onSort={w.onSort}
            onPeek={onPeek}
            onRetry={data.refetch}
            onClearFilters={() => {
              change({ ...NO_FILTERS, search: "", view: "all" });
            }}
          />
          {only ? <OrderOperationLog orderNo={only.orderNo} /> : null}
          {/* Every figure here is made up, and the label stays where the count is. */}
          <div className="od-foot">
            <DemoBadge kind="synthetic" />
            <Pagination
              page={query.page}
              pageSize={query.pageSize}
              total={status === "ready" ? w.filtered.length : 0}
              pageSizes={PAGE_SIZES}
              onPage={(page) => {
                change({ page });
              }}
              onPageSize={(pageSize) => {
                change({ pageSize });
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
