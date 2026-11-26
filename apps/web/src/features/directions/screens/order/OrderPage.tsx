import { useTranslation } from "react-i18next";
import { ErrorPanel, PermissionDenied } from "@/components/common";
import { ApiError } from "@/lib/api/errors";
import { useOrdersOne } from "@/lib/api/generated/endpoints/orders/orders";
import { useTrackerList } from "@/lib/api/generated/endpoints/tracker/tracker";
import { isForbidden } from "@/lib/query-status";
import { OrderAction } from "./OrderAction";
import { OrderBack } from "./OrderBack";
import { OrderFacts } from "./OrderFacts";
import { OrderHeader } from "./OrderHeader";
import { OrderJourneySection } from "./OrderJourneySection";
import { OrderNotFound } from "./OrderNotFound";
import { orderTone } from "./orderTone";
import { statusSentence } from "./statusSentence";
import { OrderSkeleton } from "./OrderSkeleton";
import { OrderStatus } from "./OrderStatus";
import { OrderTabs } from "./OrderTabs";
import { stageFactsOf } from "./stageFacts";
import { SubmittedNotice } from "./SubmittedNotice";
import { ALL_DONE, isTypedHere, isUntracked } from "../orders/orderRow";
import { untracked } from "./untracked";
import { useOrderAction } from "./useOrderAction";
import { useOrderFlow } from "./useOrderFlow";
import { useOrderJourney } from "./useOrderJourney";
import "../orders/orders.css";
import "./order.css";

/**
 * One order. The first screen answers who has it (its stage and the team
 * that holds it), why when the data gives a reason (a shortage, or a failed
 * check), and the latest act a person made, with the person's own task as
 * the one primary button; then the facts, the journey as one row of nine
 * steps, and the tabs Lines (open first), Documents, Checks and Activity.
 * The tracker gives the events, checks and matches; the Orders API gives the
 * lines and the masked prices; the workflow's record gives the latest act
 * and the documents.
 */
export function OrderPage({ orderNo }: { orderNo: string }) {
  const { t } = useTranslation("directions-orders");
  const { t: tc } = useTranslation("common");
  // The route has already asked for this order. An order that is not there
  // answered 404, and asking again on mount would put the query back to
  // pending: the route would draw its skeleton, unmount this page, and mount
  // it again for ever.
  const detail = useOrdersOne(orderNo, { query: { retryOnMount: false } });
  // A draft, a void order, or a submitted one that no team holds is not in
  // the tracker or the flow: neither is asked, and the order's own facts and
  // lines are the page. Until the order has answered nothing is asked either.
  const known = detail.data?.data;
  const asksTracker = !detail.isPending && !(known && isUntracked(known));
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

  const back = <OrderBack />;
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
  const typedHere = found !== undefined && isTypedHere(found);
  const { stageLabel, heldAt } = stageFactsOf({ t, tc, order, found });
  const late = events.overdue.overdue;
  const step = journey?.current ?? null;
  // A finished order has nothing left to hold it: a check that once failed,
  // or a shortage once named, no longer says anything about an order with
  // every step done.
  const sentence =
    step === ALL_DONE
      ? ""
      : statusSentence(t, {
          detail: found ?? null,
          checks: events.checks,
          asStock: typedHere,
        });
  const tone = orderTone(late, sentence !== "");

  return (
    <div className="dx-sheet dx-page od-order">
      <OrderHeader
        orderNo={orderNo}
        customerName={customer}
        customerNo={events.customerNo}
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
      {found ? <SubmittedNotice detail={found} /> : null}
      <div className="od-top-row">
        <OrderStatus
          orderNo={orderNo}
          sentence={sentence}
          overdue={events.overdue}
          timeline={flow.data?.data.timeline}
          stageLabel={stageLabel}
          heldAt={heldAt}
          step={step}
        />
        <OrderFacts order={events} detail={found} />
      </div>
      <div className="dx-grid dx-page">
        <OrderJourneySection
          journey={journey}
          late={late}
          refused={trackerRefused}
          typedHere={typedHere}
          tone={tone}
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
            typedHere={typedHere}
          />
        </section>
      </div>
    </div>
  );
}
