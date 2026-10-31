import {
  DEFAULT_DOCUMENT_CONFIG,
  parseRecordNumber,
  type RecordType,
} from "@orderpilot/shared";
import { syntheticDataset } from "@orderpilot/synthetic-data";
import type { DbClient } from "../../database/database.js";
import {
  SALES_FLOW_KEY,
  SALES_FLOW_VERSION,
  STARTER_SALES_STEPS,
} from "./domain/sales-flow.js";
import { mockId } from "./mock/fixtures.js";
import { MOCK_CURRENT_STEP } from "./mock/mock-flows.js";

/**
 * The area 2 sample rows, safe to run again. This is the one place the base
 * writes a workflow instance's `status`, and it writes the dataset's
 * `sample-` label, never a real status: the values are the state machine's to
 * decide (C-2). Every row has a fixed id, so a second run finds what the first
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
