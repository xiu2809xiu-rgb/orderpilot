import {
  DEMO_PERSONAS,
  ROLE_LABELS,
  addDecimal,
  compareDecimal,
  multiplyDecimal,
  type OrderFlow,
  type OrderStep,
  type OrderTimelineEvent,
  type PaymentConfirmation,
  type Role,
} from "@orderpilot/shared";
import type {
  SampleOrder,
  SampleScreenState,
} from "@orderpilot/synthetic-data";
import { STARTER_SALES_STEPS, stepLabel } from "../domain/sales-flow.js";
import {
  MOCK_NOW,
  MOCK_STEP_DUE_DAYS,
  addDays,
  isoAt,
  mockId,
} from "./fixtures.js";

/**
 * Where each sample order stands, for display only. The key is the step it is
 * waiting at, or null when it has passed them all. This is a stand-in for the
 * state machine (C-2): it decides nothing and nothing may branch on it.
 */
export const MOCK_CURRENT_STEP: Record<SampleScreenState, string | null> = {
  "sample-po-received": "po-received",
  "sample-extracted-awaiting-review": "fields-confirmed",
  "sample-short-stock": "spr-approval",
  "sample-awaiting-payment": "payment-confirmed",
  "sample-pending-approval": "spr-approval",
  "sample-ready-to-pick": "packed",
  "sample-packing-list-mismatch": "packed",
  "sample-awb-overdue": "shipping-documents",
  "sample-shipped": null,
  "sample-invoiced": null,
};

/** Orders that went through SPR approval; for the rest the optional step is skipped. */
export function needsSpr(order: SampleOrder): boolean {
  return (
    order.scenario.kind === "short-stock" ||
    order.sampleScreenState === "sample-pending-approval" ||
    order.header.no === "SO-0009"
  );
}

export function stepDueDate(order: SampleOrder, key: string): string {
  const scenario = order.scenario;
  if (scenario.kind === "awb-overdue" && key === "shipping-documents") {
    return scenario.dueDate;
  }
  return addDays(order.header.orderDate, MOCK_STEP_DUE_DAYS[key] ?? 0);
}

function linesTotal(order: SampleOrder): string {
  return order.lines.reduce(
    (sum, line) => addDecimal(sum, line.lineAmount),
    "0",
  );
}

function stepsOf(order: SampleOrder): OrderStep[] {
  const current = MOCK_CURRENT_STEP[order.sampleScreenState];
  const currentIndex =
    current === null
      ? STARTER_SALES_STEPS.length
      : STARTER_SALES_STEPS.findIndex((step) => step.key === current);
  return STARTER_SALES_STEPS.map((step, index) => {
    const due = stepDueDate(order, step.key);
    const dueAt = isoAt(due, 9);
    const past = index < currentIndex;
    const skipped = past && step.optional && !needsSpr(order);
    const state = skipped
      ? "skipped"
      : past
        ? "done"
        : index === currentIndex
          ? "current"
          : "upcoming";
    return {
      key: step.key,
      ownerRole: step.ownerRole,
      state,
      optional: step.optional,
      dueAt,
      completedAt:
        state === "done"
          ? isoAt(
              due < order.header.orderDate ? order.header.orderDate : due,
              8,
            )
          : null,
      overdue: state === "current" && new Date(dueAt) < MOCK_NOW,
    };
  });
}

function paymentOf(
  order: SampleOrder,
  steps: OrderStep[],
): OrderFlow["payment"] {
  const percent = order.header.prepaymentPercent;
  const paymentStep = steps.find((step) => step.key === "payment-confirmed");
  const confirmations: PaymentConfirmation[] = [];
  if (compareDecimal(percent, "0") > 0 && paymentStep?.state === "done") {
    const share = (Number(percent) / 100).toFixed(4);
    confirmations.push({
      id: mockId(300_000 + Number(order.header.no.slice(3))),
      orderNo: order.header.no,
      paymentType: "PREPAYMENT",
      amount: multiplyDecimal(linesTotal(order), share),
      currencyCode: "USD",
      reference: `TT-${order.header.no.slice(3)}-PRE`,
      paidOn: paymentStep.completedAt?.slice(0, 10) ?? order.header.orderDate,
      confirmedAt: paymentStep.completedAt ?? isoAt(order.header.orderDate),
      confirmedBy: DEMO_PERSONAS.FINANCE,
    });
  }
  const amountDue =
    order.scenario.kind === "awaiting-payment"
      ? order.scenario.amountDue
      : null;
  return { prepaymentPercent: percent, amountDue, confirmations };
}

function timelineOf(
  order: SampleOrder,
  steps: OrderStep[],
  payment: OrderFlow["payment"],
): OrderTimelineEvent[] {
  const base = 400_000 + Number(order.header.no.slice(3)) * 100;
  let n = 0;
  const event = (
    at: string,
    kind: OrderTimelineEvent["kind"],
    actor: OrderTimelineEvent["actor"],
    summary: string,
  ): OrderTimelineEvent => ({
    id: mockId(base + n++),
    at,
    kind,
    actor,
    summary,
  });
  const person = (role: Role) => ({
    kind: "user" as const,
    name: DEMO_PERSONAS[role],
  });
  const system = { kind: "system" as const, name: "OrderPilot" };

  const events = [
    event(
      isoAt(order.header.orderDate),
      "order.received",
      system,
      `PO ${order.header.externalDocumentNo} received for ${order.header.no}`,
    ),
  ];
  for (const step of steps) {
    if (
      step.state === "done" &&
      step.completedAt &&
      step.key !== "po-received"
    ) {
      events.push(
        event(
          step.completedAt,
          "step.completed",
          person(step.ownerRole),
          `${stepLabel(step.key)} done`,
        ),
      );
    }
    if (step.state === "current") {
      events.push(
        event(
          isoAt(order.header.orderDate, 9),
          "task.created",
          system,
          `Task for ${ROLE_LABELS[step.ownerRole]}: ${stepLabel(step.key)}`,
        ),
      );
      if (step.overdue) {
        events.push(
          event(
            isoAt(order.header.orderDate, 10),
            "reminder.sent",
            system,
            `Reminder to ${ROLE_LABELS[step.ownerRole]}: ${stepLabel(step.key)} is overdue`,
          ),
        );
      }
    }
  }
  for (const paid of payment.confirmations) {
    events.push(
      event(
        paid.confirmedAt,
        "payment.confirmed",
        person("FINANCE"),
        `${paid.paymentType} of ${paid.amount} ${paid.currencyCode} confirmed`,
      ),
    );
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}

export function buildFlow(order: SampleOrder, customerName: string): OrderFlow {
  const steps = stepsOf(order);
  const payment = paymentOf(order, steps);
  return {
    order: {
      no: order.header.no,
      sellToCustomerNo: order.header.sellToCustomerNo,
      customerName,
      externalDocumentNo: order.header.externalDocumentNo,
      orderDate: order.header.orderDate,
    },
    steps,
    timeline: timelineOf(order, steps, payment),
    payment,
  };
}
