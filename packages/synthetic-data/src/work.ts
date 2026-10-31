import type { InboxRole, TaskKind } from "@orderpilot/shared";
import { addDays, atHour, daysBetween } from "./dates.js";
import { syntheticId } from "./records.js";
import type {
  Customer,
  SampleOrder,
  SampleReminder,
  SampleSpr,
  SampleTask,
} from "./types.js";

interface TaskPlan {
  readonly kind: TaskKind;
  readonly role: InboxRole;
  readonly title: string;
}

/** The task an order's sample state has waiting, and who in the team holds it. */
function planFor(order: SampleOrder): TaskPlan | null {
  const { scenario } = order;
  const awb = (type: string) =>
    type === "AWB" ? "air waybill" : "bill of lading";
  switch (order.sampleScreenState) {
    case "sample-po-received":
      return {
        kind: "REVIEW_FIELDS",
        role: "SUPPORT",
        title: "Check the fields read from the PO",
      };
    case "sample-extracted-awaiting-review":
      return {
        kind: "REVIEW_FIELDS",
        role: "SUPPORT",
        title:
          scenario.kind === "price-mismatch"
            ? "Confirm the unit price that differs from the price list"
            : `Confirm the ${String(2 + (Number(order.header.no.slice(3)) % 3))} uncertain fields`,
      };
    case "sample-short-stock":
      return {
        kind: "RAISE_SPR",
        role: "PRODUCT_MANAGER",
        title: "Review the suggested stock purchase request",
      };
    case "sample-pending-approval":
      return {
        kind: "APPROVE_SPR",
        role: "APPROVER",
        title: "Approve or reject the stock purchase request",
      };
    case "sample-pi-to-send":
      return {
        kind: "SEND_PI",
        role: "SUPPORT",
        title: "Check and send the proforma invoice",
      };
    case "sample-awaiting-payment":
      return {
        kind: "CONFIRM_PAYMENT",
        role: "FINANCE",
        title:
          Number(order.header.prepaymentPercent) === 30
            ? "Confirm the deposit"
            : "Confirm the prepayment",
      };
    case "sample-ready-to-pick":
      return {
        kind: "PACK_ORDER",
        role: "WAREHOUSE",
        title: "Pick and pack the order",
      };
    case "sample-packing-list-mismatch":
      return {
        kind: "PACK_ORDER",
        role: "WAREHOUSE",
        title: "Recount the cartons against the packing list",
      };
    case "sample-awb-overdue":
      return {
        kind: "ADD_SHIPPING_DOCUMENTS",
        role: "LOGISTICS",
        title: `Add the ${awb(scenario.kind === "awb-overdue" ? scenario.documentType : "AWB")}`,
      };
    case "sample-shipped":
      return scenario.kind === "import-permit-missing"
        ? {
            kind: "ADD_SHIPPING_DOCUMENTS",
            role: "LOGISTICS",
            title: "Add the import permit",
          }
        : null;
    case "sample-invoiced":
      return order.step.dueOn
        ? {
            kind: "CONFIRM_PAYMENT",
            role: "FINANCE",
            title: "Confirm the balance payment",
          }
        : null;
    default:
      return null;
  }
}

const OWNER_OF: Readonly<Record<InboxRole, keyof SampleOrder["owners"]>> = {
  PRODUCT_MANAGER: "productManager",
  APPROVER: "approver",
  SUPPORT: "support",
  WAREHOUSE: "warehouse",
  FINANCE: "finance",
  LOGISTICS: "logistics",
};

/** One open task for each order that has work waiting, with the customer, amount and priority a person needs. */
export function makeTasks(
  orders: readonly SampleOrder[],
  customers: readonly Customer[],
  sprs: readonly SampleSpr[],
  reference: string,
): SampleTask[] {
  const tasks: SampleTask[] = [];
  for (const order of orders) {
    const plan = planFor(order);
    const dueOn = order.step.dueOn;
    if (!plan || !dueOn) continue;
    const customer = customers.find(
      (c) => c.no === order.header.sellToCustomerNo,
    );
    const spr = sprs.find((s) => s.orderNo === order.header.no);
    const pi = order.documents.find((d) => d.type === "PROFORMA_INVOICE");
    const recordNo =
      plan.kind === "RAISE_SPR" || plan.kind === "APPROVE_SPR"
        ? (spr?.recordNo ?? null)
        : plan.kind === "SEND_PI"
          ? (pi?.number ?? null)
          : null;
    tasks.push({
      id: syntheticId(1, tasks.length + 1),
      kind: plan.kind,
      title: plan.title,
      assigneeRole: plan.role,
      assigneeName: order.owners[OWNER_OF[plan.role]],
      orderNo: order.header.no,
      ref: recordNo ? { recordNo, navisionNo: spr?.navisionNo ?? null } : null,
      status: "OPEN",
      createdAt: atHour(order.step.enteredOn, 2 + (tasks.length % 6)),
      dueAt: atHour(dueOn, 9),
      overdue: dueOn < reference,
      customerNo: order.header.sellToCustomerNo,
      customerName: customer?.name ?? order.header.sellToCustomerNo,
      amount: order.total,
      currencyCode: "USD",
      priority: order.priority,
    });
  }
  return tasks;
}

function reminderFor(
  task: SampleTask,
  scenarioKind: string,
): {
  kind: SampleReminder["kind"];
  message: string;
} {
  const orderNo = task.orderNo ?? "";
  switch (task.kind) {
    case "CONFIRM_PAYMENT":
      return {
        kind: "PAYMENT_DUE",
        message: `The payment for ${orderNo} has not been confirmed.`,
      };
    case "ADD_SHIPPING_DOCUMENTS":
      return scenarioKind === "import-permit-missing"
        ? {
            kind: "IMPORT_PERMIT_MISSING",
            message: `No import permit is on file for ${orderNo}.`,
          }
        : {
            kind: "SHIPPING_DOCUMENT_MISSING",
            message: `The shipping document for ${orderNo} is still missing.`,
          };
    default:
      return { kind: "TASK_DUE", message: `${task.title} for ${orderNo}.` };
  }
}

/**
 * Reminders for the tasks that are due tomorrow or late: scheduled before the
 * due day, sent once it has passed, and escalated to management when a task
 * is three days late. The days are fixtures, not the reminders story's rules.
 */
export function makeReminders(
  tasks: readonly SampleTask[],
  orders: readonly SampleOrder[],
  reference: string,
): SampleReminder[] {
  const reminders: SampleReminder[] = [];
  for (const task of tasks) {
    const dueOn = task.dueAt.slice(0, 10);
    const late = daysBetween(dueOn, reference);
    if (late < -1) continue;
    const order = orders.find((o) => o.header.no === task.orderNo);
    const { kind, message } = reminderFor(task, order?.scenario.kind ?? "none");
    const escalated = late >= 3;
    reminders.push({
      id: syntheticId(2, reminders.length + 1),
      kind,
      stage: escalated ? "escalated" : late >= 0 ? "sent" : "scheduled",
      orderNo: task.orderNo ?? "",
      message,
      toRole: task.assigneeRole,
      dueAt: task.dueAt,
      remindAt: atHour(
        late >= 0 ? addDays(dueOn, Math.min(late, 1)) : dueOn,
        1,
      ),
      escalatesAt: escalated ? null : atHour(addDays(dueOn, 3), 1),
      escalatedTo: escalated ? "MANAGEMENT" : null,
    });
  }
  return reminders;
}
