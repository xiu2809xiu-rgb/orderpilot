import {
  DEFAULT_DOCUMENT_CONFIG,
  DEFAULT_TASK_SLAS,
  compareDecimal,
  multiplyDecimal,
  parseRecordNumber,
  roundToCents,
  type RecordType,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import { demoEmail } from "../../auth/demo-accounts.js";
import type { DbClient } from "../../database/database.js";
import {
  SALES_FLOW_KEY,
  SALES_FLOW_VERSION,
  STARTER_SALES_STEPS,
} from "./domain/sales-flow.js";
import { scheduleOf } from "./domain/task-schedule.js";
import { mockId } from "./mock/fixtures.js";
import { MOCK_CURRENT_STEP } from "./mock/mock-flows.js";

/**
 * The area 2 sample rows, safe to run again. Beside the state machine's
 * repository, this is the one place that writes a workflow instance's `status`.
 * It writes the dataset's `sample-` label, which the machine refuses to run,
 * except for the orders whose SPR waits for a decision (see
 * `seedOrdersAwaitingSpr`). Every row has a fixed id, so a second run finds what the first
 * left and adds nothing, even on another day (the rows keep the dates of the
 * day they were first written).
 */
export async function seedWorkflows(client: DbClient): Promise<string> {
  const dataset = syntheticDataset();
  const definitionId = mockId(600_001);

  await client.workflowDefinition.createMany({
    data: [
      {
        id: definitionId,
        key: SALES_FLOW_KEY,
        version: SALES_FLOW_VERSION,
        name: "Sales order",
        description: "A starter list of steps. The state machine replaces it.",
        config: { steps: STARTER_SALES_STEPS.map((step) => ({ ...step })) },
      },
    ],
    skipDuplicates: true,
  });

  await client.documentTypeConfig.createMany({
    data: DEFAULT_DOCUMENT_CONFIG.map((entry) => ({
      documentType: entry.documentType,
      fields: entry.fields.map((field) => ({ ...field })),
    })),
    skipDuplicates: true,
  });

  const instanceIds = new Map<string, string>();
  const instances = dataset.orders.map((order, index) => {
    const id = mockId(500_000 + index);
    instanceIds.set(order.header.no, id);
    return {
      id,
      definitionId,
      orderRef: order.header.no,
      status: order.sampleScreenState,
      currentStep: MOCK_CURRENT_STEP[order.sampleScreenState],
      startedAt: new Date(`${order.header.orderDate}T01:00:00.000Z`),
    };
  });
  await client.workflowInstance.createMany({
    data: instances,
    skipDuplicates: true,
  });

  await client.workflowEvent.createMany({
    data: dataset.orders.map((order, index) => ({
      id: mockId(510_000 + index),
      instanceId: instanceIds.get(order.header.no) ?? "",
      type: "order.received",
      toStatus: order.sampleScreenState,
      actorKind: "system",
      actorName: "seed",
      summary: `Sample order ${order.header.no} loaded`,
      idempotencyKey: "seed:order.received",
      occurredAt: new Date(`${order.header.orderDate}T01:00:00.000Z`),
    })),
    skipDuplicates: true,
  });

  // Where a task is about a record (an SPR, a PI), the task points at its number.
  await client.workflowTask.createMany({
    data: dataset.tasks.map((task) => ({
      id: task.id,
      instanceId: instanceIds.get(task.orderNo ?? "") ?? "",
      kind: task.kind,
      title: task.title,
      assigneeRole: task.assigneeRole,
      recordNo: task.ref?.recordNo ?? null,
      dueAt: new Date(task.dueAt),
      createdAt: new Date(task.createdAt),
    })),
    skipDuplicates: true,
  });

  await client.workflowNotification.createMany({
    data: dataset.reminders.map((reminder) => ({
      id: reminder.id,
      instanceId: instanceIds.get(reminder.orderNo) ?? null,
      kind:
        reminder.stage === "escalated"
          ? ("ESCALATION" as const)
          : ("REMINDER" as const),
      recipientRole: reminder.escalatedTo ?? reminder.toRole,
      orderRef: reminder.orderNo,
      message: reminder.message,
      scheduledFor: new Date(reminder.remindAt),
      escalatesAt: reminder.escalatesAt ? new Date(reminder.escalatesAt) : null,
      sentAt:
        reminder.stage === "scheduled" ? null : new Date(reminder.remindAt),
    })),
    skipDuplicates: true,
  });

  // OrderPilot's own record numbers (SPR, PI, EXC), so the database and the screens agree.
  const numbers: {
    orderNo: string;
    recordNo: string;
    navisionNo: string | null;
  }[] = [
    ...dataset.sprs.map((s) => ({
      orderNo: s.orderNo,
      recordNo: s.recordNo,
      navisionNo: s.navisionNo,
    })),
    ...dataset.orders.flatMap((order) =>
      order.documents
        .filter((d) => d.type === "PROFORMA_INVOICE" && d.number)
        .map((d) => ({
          orderNo: order.header.no,
          recordNo: d.number ?? "",
          navisionNo: null,
        })),
    ),
    ...dataset.exceptions.map((e) => ({
      orderNo: e.orderNo,
      recordNo: e.recordNo,
      navisionNo: null,
    })),
  ];
  const records = numbers.flatMap((entry, index) => {
    const parsed = parseRecordNumber(entry.recordNo);
    return parsed ? [{ ...entry, ...parsed, index }] : [];
  });
  await client.workflowRecord.createMany({
    data: records.map((record) => ({
      id: mockId(520_000 + record.index),
      recordNo: record.recordNo,
      recordType: record.type,
      navisionNo: record.navisionNo,
      instanceId: instanceIds.get(record.orderNo) ?? null,
    })),
    skipDuplicates: true,
  });
  await seedOrdersAwaitingSpr(client, dataset, instanceIds);
  await seedOrdersShortOfStock(client, dataset, instanceIds);

  await client.workflowTaskSla.createMany({
    data: DEFAULT_TASK_SLAS.map((sla) => ({ ...sla })),
    skipDuplicates: true,
  });

  const highest = new Map<
    string,
    { type: RecordType; day: string; value: number }
  >();
  for (const { type, date, sequence } of records) {
    const key = `${type}-${date}`;
    const seen = highest.get(key);
    if (!seen || seen.value < sequence)
      highest.set(key, { type, day: date, value: sequence });
  }
  for (const { type, day, value } of highest.values()) {
    await client.recordCounter.upsert({
      where: { recordType_day: { recordType: type, day } },
      create: { recordType: type, day, lastValue: value },
      // Never move a counter backwards: a real number may have been taken.
      update: {},
    });
  }

  return `${String(instances.length)} sample orders, ${String(dataset.tasks.length)} tasks, ${String(dataset.reminders.length)} reminders, ${String(records.length)} record numbers and ${String(DEFAULT_DOCUMENT_CONFIG.length)} document types`;
}

/**
 * Puts the orders with a submitted SPR on the state machine, so the approval
 * page really works in the demo. A label that a person's decision has already
 * moved on is left alone, and so is a record that already has its data, so a
 * second run changes nothing.
 */
async function seedOrdersAwaitingSpr(
  client: DbClient,
  dataset: ReturnType<typeof syntheticDataset>,
  instanceIds: ReadonlyMap<string, string>,
): Promise<void> {
  const requester = await client.user.findUnique({
    where: { email: demoEmail("PRODUCT_MANAGER") },
    select: { id: true },
  });
  if (!requester) return;
  const now = new Date();
  const approveSprSla = DEFAULT_TASK_SLAS.find(
    (sla) => sla.taskKind === "APPROVE_SPR",
  );

  const orders = new Map(
    dataset.orders.map((order) => [order.header.no, order]),
  );
  for (const spr of dataset.sprs.filter((s) => s.status === "submitted")) {
    const order = orders.get(spr.orderNo);
    const instanceId = instanceIds.get(spr.orderNo);
    if (order?.sampleScreenState !== "sample-pending-approval" || !instanceId) {
      continue;
    }
    await client.workflowInstance.updateMany({
      where: { id: instanceId, status: "sample-pending-approval" },
      data: {
        status: "AwaitingSpr",
        currentStep: "spr-approval",
        facts: {
          prepaymentDue: prepaymentOf(order),
          stockCoversOrder: false,
          holds: [],
          resumeTo: null,
          enteredAt: spr.requestedAt,
        },
      },
    });
    // By the order, not the number: the dataset's SPR numbers move with the date,
    // so on a later day the record keeps the number it was first written with.
    const record = await client.workflowRecord.findFirst({
      where: { recordType: "SPR", instanceId },
      select: { id: true, data: true },
    });
    if (!record) continue;
    if (record.data !== null) continue;
    // Its clock starts now, so the demo's dated fixtures do not arrive overdue.
    await client.workflowTask.updateMany({
      where: { instanceId, kind: "APPROVE_SPR" },
      data: {
        createdAt: now,
        dueAt: approveSprSla ? scheduleOf(now, approveSprSla).dueAt : now,
      },
    });
    await client.workflowRecord.update({
      where: { id: record.id },
      data: {
        data: {
          amount: spr.amount,
          requesterUserId: requester.id,
          decision: null,
          passedOn: null,
        },
      },
    });
  }
}

/** The prepayment the gate waits for, or null when the order asks for none. */
function prepaymentOf(
  order: ReturnType<typeof syntheticDataset>["orders"][number],
): string | null {
  const due = roundToCents(
    multiplyDecimal(
      multiplyDecimal(order.total, order.header.prepaymentPercent),
      "0.01",
    ),
  );
  return compareDecimal(due, "0") > 0 ? due : null;
}

/**
 * Puts the orders whose SPR the product manager has still to raise on the state
 * machine, at the stock check with the stock short, so that Raise really sends
 * the SPR to the approvers (#251, #290). The SPR's record keeps no data until it
 * is raised. A label someone has already moved on is left alone, so a second run
 * changes nothing.
 */
async function seedOrdersShortOfStock(
  client: DbClient,
  dataset: ReturnType<typeof syntheticDataset>,
  instanceIds: ReadonlyMap<string, string>,
): Promise<void> {
  const now = new Date();
  const raiseSprSla = DEFAULT_TASK_SLAS.find(
    (sla) => sla.taskKind === "RAISE_SPR",
  );
  const orders = new Map(
    dataset.orders.map((order) => [order.header.no, order]),
  );
  for (const spr of dataset.sprs.filter((s) => s.status === "suggested")) {
    const order = orders.get(spr.orderNo);
    const instanceId = instanceIds.get(spr.orderNo);
    if (order?.sampleScreenState !== "sample-short-stock" || !instanceId) {
      continue;
    }
    const moved = await client.workflowInstance.updateMany({
      where: { id: instanceId, status: "sample-short-stock" },
      data: {
        status: "StockChecked",
        currentStep: "spr-approval",
        facts: {
          prepaymentDue: prepaymentOf(order),
          stockCoversOrder: false,
          holds: [],
          resumeTo: null,
          enteredAt: spr.requestedAt,
        },
      },
    });
    if (moved.count === 0) continue;
    // Its clock starts now, so the demo's dated fixtures do not arrive overdue.
    await client.workflowTask.updateMany({
      where: { instanceId, kind: "RAISE_SPR" },
      data: {
        createdAt: now,
        dueAt: raiseSprSla ? scheduleOf(now, raiseSprSla).dueAt : now,
      },
    });
  }
}
