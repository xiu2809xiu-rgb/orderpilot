import {
  formatRecordNumber,
  type RecordRef,
  type Role,
  type TaskKind,
  type WorkflowTask,
} from "@orderpilot/shared";
import type {
  SampleOrder,
  SampleScreenState,
} from "@orderpilot/synthetic-data";
import { MOCK_NOW, isoAt, mockId } from "./fixtures.js";
import { MOCK_CURRENT_STEP, stepDueDate } from "./mock-flows.js";

/** Which sample order has which SPR, with OrderPilot's number. Navision has none of them yet. */
const SPR_DAY = new Date(MOCK_NOW);
export const MOCK_SPR_REFS: Readonly<Record<string, RecordRef>> = {
  "SO-0003": {
    recordNo: formatRecordNumber("SPR", SPR_DAY, 1),
    navisionNo: null,
  },
  "SO-0005": {
    recordNo: formatRecordNumber("SPR", SPR_DAY, 2),
    navisionNo: null,
  },
  "SO-0009": {
    recordNo: formatRecordNumber("SPR", new Date("2026-10-27T02:00:00Z"), 1),
    navisionNo: "PO-0021",
  },
};

interface TaskPlan {
  readonly kind: TaskKind;
  readonly role: Role;
  readonly title: string;
}

/** The task a sample order has waiting, for display. Azri's state machine decides this for real. */
const PLAN: Partial<Record<SampleScreenState, TaskPlan>> = {
  "sample-po-received": {
    kind: "REVIEW_FIELDS",
    role: "SUPPORT",
    title: "Check the fields read from the PO",
  },
  "sample-extracted-awaiting-review": {
    kind: "REVIEW_FIELDS",
    role: "SUPPORT",
    title: "Confirm the two uncertain fields",
  },
  "sample-short-stock": {
    kind: "RAISE_SPR",
    role: "PRODUCT_MANAGER",
    title: "Review the suggested stock purchase request",
  },
  "sample-awaiting-payment": {
    kind: "CONFIRM_PAYMENT",
    role: "FINANCE",
    title: "Confirm the prepayment",
  },
  "sample-pending-approval": {
    kind: "APPROVE_SPR",
    role: "APPROVER",
    title: "Approve or reject the stock purchase request",
  },
  "sample-ready-to-pick": {
    kind: "PACK_ORDER",
    role: "WAREHOUSE",
    title: "Pick and pack the order",
  },
  "sample-packing-list-mismatch": {
    kind: "PACK_ORDER",
    role: "WAREHOUSE",
    title: "Recount the cartons against the packing list",
  },
  "sample-awb-overdue": {
    kind: "ADD_SHIPPING_DOCUMENTS",
    role: "LOGISTICS",
    title: "Add the air waybill",
  },
};

export function buildTasks(orders: readonly SampleOrder[]): WorkflowTask[] {
  const tasks: WorkflowTask[] = [];
  orders.forEach((order, index) => {
    const plan = PLAN[order.sampleScreenState];
    const stepKey = MOCK_CURRENT_STEP[order.sampleScreenState];
    if (!plan || !stepKey) return;
    const dueAt = isoAt(stepDueDate(order, stepKey), 9);
    tasks.push({
      id: mockId(100_000 + index),
      kind: plan.kind,
      title: plan.title,
      assigneeRole: plan.role,
      orderNo: order.header.no,
      ref: MOCK_SPR_REFS[order.header.no] ?? null,
      status: "OPEN",
      createdAt: isoAt(order.header.orderDate, 9),
      dueAt,
      overdue: new Date(dueAt) < MOCK_NOW,
    });
  });
  return tasks;
}
