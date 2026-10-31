import {
  DEMO_PERSONAS,
  ROLE_LABELS,
  type OrderFlow,
  type OrderStep,
  type OrderTimelineEvent,
  type PaymentRecord,
  type Role,
} from "@orderpilot/shared";
import type {
  Milestone,
  SampleOrder,
  SamplePayment,
  SampleScreenState,
} from "@orderpilot/synthetic-data";
import { STARTER_SALES_STEPS, stepLabel } from "../domain/sales-flow.js";
import {
  MOCK_STEP_DUE_DAYS,
  addDays,
  isoAt,
  mockId,
  mockNow,
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
  "sample-pending-approval": "spr-approval",
  "sample-pi-to-send": "pi-sent",
  "sample-awaiting-payment": "payment-confirmed",
  "sample-ready-to-pick": "packed",
  "sample-packing-list-mismatch": "packed",
  "sample-awb-overdue": "shipping-documents",
  "sample-shipped": null,
  "sample-invoiced": null,
  "sample-closed": null,
};

/** The dataset's fixture milestone that finishes each step, where it has one. */
const STEP_MILESTONE: Readonly<Record<string, Milestone>> = {
  "fields-confirmed": "fields",
  "stock-checked": "stock",
  "spr-approval": "approved",
  "pi-sent": "pi",
  "payment-confirmed": "paid",
  packed: "packed",
  invoiced: "invoiced",
  "shipping-documents": "shipped",
};

/** Orders that went through SPR approval; for the rest the optional step is skipped. */
export function needsSpr(order: SampleOrder): boolean {
  return order.stockShortfall !== null;
}

/** The order's own due date for the step it waits at; a fixture date for the rest. */
export function stepDueDate(order: SampleOrder, key: string): string {
  if (MOCK_CURRENT_STEP[order.sampleScreenState] === key && order.step.dueOn) {
    return order.step.dueOn;
  }
  return addDays(order.header.orderDate, MOCK_STEP_DUE_DAYS[key] ?? 0);
}

/** A done step is dated by the dataset's milestone, else by its due date, never after today or before the order. */
function doneOn(order: SampleOrder, key: string, due: string, asOf: string) {
  const milestone = STEP_MILESTONE[key];
  const known = milestone ? order.milestones[milestone] : undefined;
  if (known) return known;
  const day = due > asOf ? asOf : due;
  return day < order.header.orderDate ? order.header.orderDate : day;
}

function stepsOf(order: SampleOrder, asOf: string): OrderStep[] {
  const now = mockNow(asOf);
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
        state === "done" ? isoAt(doneOn(order, step.key, due, asOf), 8) : null,
      overdue: state === "current" && new Date(dueAt) < now,
    };
  });
}

function paymentOf(
  order: SampleOrder,
  payments: readonly SamplePayment[],
): OrderFlow["payment"] {
  const mine = payments.filter((p) => p.orderNo === order.header.no);
  const confirmations: PaymentRecord[] = mine.flatMap((p) =>
    p.status === "confirmed" && p.reference && p.paidOn && p.confirmedAt
      ? [
          {
            id: p.id,
            orderNo: p.orderNo,
            paymentType: p.paymentType,
            amount: p.amount,
            currencyCode: p.currencyCode,
            reference: p.reference,
            paidOn: p.paidOn,
            confirmedAt: p.confirmedAt,
            confirmedBy: p.confirmedBy ?? DEMO_PERSONAS.FINANCE,
          },
        ]
      : [],
  );
  const due = mine.find((p) => p.status === "expected");
  return {
    prepaymentPercent: order.header.prepaymentPercent,
    amountDue: due?.amount ?? null,
    confirmations,
  };
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
          isoAt(order.step.enteredOn, 9),
          "task.created",
          system,
          `Task for ${ROLE_LABELS[step.ownerRole]}: ${stepLabel(step.key)}`,
        ),
      );
      if (step.overdue) {
        events.push(
          event(
            isoAt(order.step.dueOn ?? order.step.enteredOn, 10),
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

export function buildFlow(
  order: SampleOrder,
  customerName: string,
  payments: readonly SamplePayment[],
  asOf: string,
): OrderFlow {
  const steps = stepsOf(order, asOf);
  const payment = paymentOf(order, payments);
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
