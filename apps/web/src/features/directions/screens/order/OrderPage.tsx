import type { OrderTimeline, SalesOrderDetail } from "@orderpilot/shared";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ErrorPanel, PermissionDenied, Toaster } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { isForbidden } from "@/lib/query-status";
import { screenPath } from "../../directions";
import { useDirection } from "../../frame/useDirection";
import { EmptyState } from "../../parts/EmptyState";
import { PageHeader } from "../../parts/PageHeader";
import { Section } from "../../parts/Section";
import { usePageCrumb } from "../../shell/pageCrumb";
import { NowCard } from "./NowCard";
import { OrderAction } from "./OrderAction";
import { OrderFacts } from "./OrderFacts";
import { OrderJourney } from "./OrderJourney";
import { OrderSkeleton } from "./OrderSkeleton";
import { OrderTabs } from "./OrderTabs";
import { useOrderAction } from "./useOrderAction";
import { useOrderJourney } from "./useOrderJourney";
import "../orders/orders.css";

/** An order entered here that the tracker does not know yet: no events, no checks, no journey. */
function untracked(detail: SalesOrderDetail): OrderTimeline {
  return {
    orderNo: detail.orderNo,
    externalDocumentNo: detail.externalDocumentNo,
    customerNo: detail.customerNo,
    customerName: detail.customerName ?? detail.customerNo,
    status: { code: "none", label: "" },
    ownerRole: "SUPPORT",
    overdue: { overdue: false, daysOverdue: 0, reason: null },
    steps: [],
    checks: [],
    matches: [],
  };
}

/**
 * One order: its header with the one thing this person can do, the facts, the
 * journey with done, now and later, and the tabs Lines, Documents, Checks and
 * Activity. The tracker gives the events, checks and matches; the Orders API
 * gives the lines and the masked prices.
 */
export function OrderPage({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("directions-orders");
  const { t: tc } = useTranslation("common");
  const direction = useDirection();
  usePageCrumb(orderNo);
  const { timeline, order, journey } = useOrderJourney(orderNo);
  const detail = useOrdersOne(orderNo);
  const waiting = useTrackerList({
    documentToConfirm: "true",
    search: orderNo,
    pageSize: 5,
  });
  const action = useOrderAction(orderNo);
  const toConfirm =
    waiting.data?.data.some((row) => row.orderNo === orderNo) ?? false;

  const back = (
    <Button asChild variant="ghost" size="sm" className="od-back">
      <Link to={screenPath(direction, "orders")}>
        <ArrowLeft aria-hidden="true" />
        {t("order.back")}
      </Link>
    </Button>
  );
  const notInTracker =
    timeline.error instanceof ApiError && timeline.error.code === "NOT_FOUND";

  if (timeline.isPending || detail.isPending) {
    return <OrderSkeleton />;
  }
  if (isForbidden(timeline.error) || isForbidden(detail.error)) {
    return (
      <div className="dx-sheet py-6">
        {back}
        <PermissionDenied />
      </div>
    );
  }
  const found = detail.data?.data;
  if ((timeline.isError && !notInTracker) || (!found && !order)) {
    const failure = timeline.error ?? detail.error;
    const missing = failure instanceof ApiError && failure.code === "NOT_FOUND";
    return (
      <div className="dx-sheet py-6">
        {back}
        {missing ? (
          <EmptyState
            icon={FileQuestion}
            title={t("order.notFoundTitle")}
            description={t("order.notFoundBody", { order: orderNo })}
          />
        ) : (
          <ErrorPanel
            error={failure}
            onRetry={() => {
              void timeline.refetch();
              void detail.refetch();
            }}
          />
        )}
      </div>
    );
  }
  const events = order ?? (found ? untracked(found) : null);
  if (!events) return <OrderSkeleton />;
  const customer = found?.customerName ?? events.customerName;
  const stageLabel =
    order?.status.label ?? found?.workflowStatus ?? t("cells.notStarted");
  const heldAt = order ? tc(`roles.${order.ownerRole}`) : t("cells.notSet");
  const late = events.overdue.overdue;

  return (
    <div className="dx-sheet od-order py-6">
      {back}
      <PageHeader
        title={orderNo}
        intro={t("order.intro", { customer, number: events.customerNo })}
        actions={
          <OrderAction
            task={action.task}
            orderNo={orderNo}
            pending={action.isPending}
          />
        }
      />
      <OrderFacts
        order={events}
        detail={found}
        stageLabel={stageLabel}
        heldAt={heldAt}
        step={journey?.current ?? null}
        overdue={events.overdue}
      />
      <div className="dx-grid mt-6 flex flex-col gap-6">
        <Section title={t("order.journey.title")}>
          {journey ? (
            <div className="od-journey">
              <NowCard
                journey={journey}
                stageLabel={stageLabel}
                heldAt={heldAt}
                shipmentDate={found?.shipmentDate ?? null}
              />
              <OrderJourney journey={journey} size="full" late={late} />
            </div>
          ) : (
            <p className="fs-14 max-w-prose text-muted-foreground">
              {t("peek.noJourney")}
            </p>
          )}
        </Section>
        <Section title={t("order.details.title")} work>
          <OrderTabs
            orderNo={orderNo}
            detail={found}
            timeline={events}
            toConfirm={toConfirm}
          />
        </Section>
      </div>
      <Toaster />
    </div>
  );
}
