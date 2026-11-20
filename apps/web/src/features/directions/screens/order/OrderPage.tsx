import type { OrderTimeline, SalesOrderDetail } from "@orderpilot/shared";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ErrorPanel, PermissionDenied } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/errors";
import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { isForbidden } from "@/lib/query-status";
import { OrderAction } from "./OrderAction";
import { OrderFacts } from "./OrderFacts";
import { OrderHeader } from "./OrderHeader";
import { OrderJourneySection } from "./OrderJourneySection";
import { OrderNotFound } from "./OrderNotFound";
import { statusSentence } from "./statusSentence";
import { OrderSkeleton } from "./OrderSkeleton";
import { OrderStatus } from "./OrderStatus";
import { OrderTabs } from "./OrderTabs";
import { isUntracked } from "../orders/orderRow";
import { useOrderAction } from "./useOrderAction";
import { useOrderFlow } from "./useOrderFlow";
import { useOrderJourney } from "./useOrderJourney";
import "../orders/orders.css";
import "./order.css";

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
 * One order. The first screen answers who has it, why and what comes next, in
 * one sentence under the title, with the latest act a person made and the
 * person's own task as the one primary button; then the facts, the journey as
 * one row of nine steps, and the tabs Lines (open first), Documents, Checks and
 * Activity. The tracker gives the events, checks and matches; the Orders API
 * gives the lines and the masked prices; the workflow's record gives the latest
 * act and the documents.
 */
export function OrderPage({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("directions-orders");
  const { t: tc } = useTranslation("common");
  // The route has already asked for this order. An order that is not there
  // answered 404, and asking again on mount would put the query back to
  // pending: the route would draw its skeleton, unmount this page, and
  // mount it again for ever.
  const detail = useOrdersOne(orderNo, { query: { retryOnMount: false } });
  // A draft or a void order is not in the tracker or the workflow: neither is
  // asked, and the order's own facts and lines are the page. Until the order
  // has answered nothing is asked either.
  const asksTracker =
    !detail.isPending && !isUntracked(detail.data?.data.captureState ?? null);
  const { timeline, order, journey } = useOrderJourney(
    asksTracker ? orderNo : null,
  );
  const waiting = useTrackerList({
    documentToConfirm: "true",
    search: orderNo,
    pageSize: 5,
  });
  const flow = useOrderFlow(orderNo, asksTracker);
  const action = useOrderAction(orderNo);
  const toConfirm =
    waiting.data?.data.some((row) => row.orderNo === orderNo) ?? false;

  const back = (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="od-back pointer-coarse:h-11"
    >
      <Link to="/orders">
        <ArrowLeft aria-hidden="true" />
        {t("order.back")}
      </Link>
    </Button>
  );
  // The tracker is where the journey, checks and events come from. An order it
  // does not know (a draft entered here) or a role it refuses still has its
  // facts and lines from the Orders API, so neither empties the page.
  const trackerRefused = isForbidden(timeline.error);
  const notInTracker =
    trackerRefused ||
    (timeline.error instanceof ApiError && timeline.error.code === "NOT_FOUND");

  if ((asksTracker && timeline.isPending) || detail.isPending) {
    return <OrderSkeleton />;
  }
  if (isForbidden(detail.error)) {
    return (
      <div className="dx-sheet">
        {back}
        <PermissionDenied />
      </div>
    );
  }
  const found = detail.data?.data;
  // An order the Orders API cannot read has no facts, lines or value: a page of
  // dashes would pass for an order with nothing on it, so it says it failed.
  const detailFailed =
    detail.isError &&
    !(detail.error instanceof ApiError && detail.error.code === "NOT_FOUND");
  if (
    (timeline.isError && !notInTracker) ||
    detailFailed ||
    (!found && !order)
  ) {
    const failure = detailFailed
      ? detail.error
      : (timeline.error ?? detail.error);
    if (failure instanceof ApiError && failure.code === "NOT_FOUND") {
      return <OrderNotFound orderNo={orderNo} />;
    }
    return (
      <div className="dx-sheet">
        {back}
        <ErrorPanel
          error={failure}
          onRetry={() => {
            void timeline.refetch();
            void detail.refetch();
          }}
        />
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
  const sentence = statusSentence(t, (role) => tc(`roles.${role}`), {
    journey,
    heldBy: order?.ownerRole ?? null,
    stage: stageLabel,
    entry: found?.captureState ?? null,
    detail: found ?? null,
  });

  return (
    <div className="dx-sheet od-order">
      <OrderHeader
        orderNo={orderNo}
        intro={t("order.intro", { customer, number: events.customerNo })}
        detail={found}
        actions={
          <OrderAction
            task={action.task}
            orderNo={orderNo}
            pending={action.isPending}
            hasInbox={action.hasInbox}
          />
        }
      />
      <OrderStatus
        orderNo={orderNo}
        sentence={sentence}
        overdue={events.overdue}
        timeline={flow.data?.data.timeline}
      />
      <OrderFacts
        order={events}
        detail={found}
        stageLabel={stageLabel}
        heldAt={heldAt}
        step={journey?.current ?? null}
      />
      <div className="dx-grid mt-4 flex flex-col gap-4">
        <OrderJourneySection
          journey={journey}
          late={late}
          shipmentDate={found?.shipmentDate ?? null}
          refused={trackerRefused}
        />
        <section
          aria-label={t("order.details.title")}
          className="dx-card dx-card-work od-details"
        >
          <OrderTabs
            orderNo={orderNo}
            detail={found}
            timeline={events}
            toConfirm={toConfirm}
            inWorkflow={asksTracker}
          />
        </section>
      </div>
    </div>
  );
}
