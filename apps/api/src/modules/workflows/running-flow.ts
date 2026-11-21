import {
  ROLE_LABELS,
  type OrderFlow,
  type OrderStep,
  type OrderTimelineEvent,
  type PaymentRecord,
} from "@orderpilot/shared";
import { stepLabel } from "./domain/sales-flow.js";
import { mockId } from "./mock/fixtures.js";
import type { OrderStatusView } from "./order-workflow.service.js";

/** How a payment type reads at the start of a sentence, as the sample flow words it. */
const PAYMENT_WORDS: Record<PaymentRecord["paymentType"], string> = {
  prepayment: "Prepayment",
  deposit: "Deposit",
  balance: "Balance",
  "full-payment": "Full payment",
};

/**
 * An order's flow once the state machine runs it: the step it waits on, and
 * whose move takes it on, come from the machine, so the order's page, the task
 * lists and the tracker give one answer to "who has it" (#290). A short order
 * waits on the product manager to raise its SPR, not on the approvers. Payments
 * the machine counted are added to the sample's own, and the timeline says
 * what changed since the sample was drawn.
 */
export function runningFlowOf(
  sample: OrderFlow,
  view: OrderStatusView,
  payments: readonly PaymentRecord[],
): OrderFlow {
  const since = view.since.toISOString();
  const currentIndex =
    view.currentStep === null
      ? sample.steps.length
      : sample.steps.findIndex((step) => step.key === view.currentStep);
  const steps = sample.steps.map((step, index): OrderStep => {
    if (index < currentIndex) {
      if (step.state === "skipped" || step.state === "done") return step;
      return { ...step, state: "done", completedAt: since, overdue: false };
    }
    if (index === currentIndex) {
      return {
        ...step,
        state: "current",
        ownerRole: view.ownerRole ?? step.ownerRole,
        completedAt: null,
      };
    }
    return { ...step, state: "upcoming", completedAt: null, overdue: false };
  });
  const current = steps[currentIndex];
  const waitingForMoney = view.status === "AwaitingPayment";
  const confirmations = [...sample.payment.confirmations, ...payments];

  return {
    ...sample,
    steps,
    payment: {
      ...sample.payment,
      amountDue: waitingForMoney ? sample.payment.amountDue : null,
      confirmations,
    },
    timeline: timelineOf(sample, steps, current, payments, since),
  };
}

/**
 * The sample's history up to where it was drawn, without its tasks and
 * reminders, which only the current step has; then each step the machine has
 * since finished, each payment it counted, and the task the order waits on now.
 */
function timelineOf(
  sample: OrderFlow,
  steps: readonly OrderStep[],
  current: OrderStep | undefined,
  payments: readonly PaymentRecord[],
  since: string,
): OrderTimelineEvent[] {
  const base = 990_000 + Number(sample.order.no.replace(/\D/g, "")) * 100;
  let n = 0;
  const system = { kind: "system" as const, name: "OrderPilot" };
  const kept = sample.timeline.filter(
    (event) => event.kind !== "task.created" && event.kind !== "reminder.sent",
  );
  const finished = steps.flatMap((step, index) => {
    const before = sample.steps[index];
    return step.state === "done" &&
      before?.state !== "done" &&
      step.key !== "payment-confirmed"
      ? [
          {
            id: mockId(base + n++),
            at: since,
            kind: "step.completed" as const,
            actor: system,
            summary: `Step done: ${stepLabel(step.key)}`,
          },
        ]
      : [];
  });
  const paid = payments.map((payment) => ({
    id: payment.id,
    at: payment.confirmedAt,
    kind: "payment.confirmed" as const,
    actor: { kind: "user" as const, name: payment.confirmedBy },
    summary: `${PAYMENT_WORDS[payment.paymentType]} of ${payment.currencyCode} ${payment.amount} confirmed`,
  }));
  const waiting = current
    ? [
        {
          id: mockId(base + n++),
          at: since,
          kind: "task.created" as const,
          actor: system,
          summary: `Task for ${ROLE_LABELS[current.ownerRole]}: ${stepLabel(current.key)}`,
        },
      ]
    : [];
  return [...kept, ...finished, ...paid, ...waiting].sort((a, b) =>
    a.at.localeCompare(b.at),
  );
}
