import {
  DEFAULT_DOCUMENT_CONFIG,
  parseRecordNumber,
  type RecordType,
} from "@orderpilot/shared";
import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import type { DbClient } from "../../database/database.js";
import {
  SALES_FLOW_KEY,
  SALES_FLOW_VERSION,
  STARTER_SALES_STEPS,
} from "./domain/sales-flow.js";
import { mockId } from "./mock/fixtures.js";
import { MOCK_CURRENT_STEP } from "./mock/mock-flows.js";
import { MOCK_REMINDERS } from "./mock/mock-reminders.js";
import { buildTasks, MOCK_SPR_REFS } from "./mock/mock-tasks.js";

/**
 * The area 2 sample rows, safe to run again. This is the one place the base
 * writes a workflow instance's `status`, and it writes the dataset's
 * `sample-` label, never a real status: the values are the state machine's to
 * decide (C-2). Every row has a fixed id, so a second run finds what the first
 * left and adds nothing.
 */
export async function seedWorkflows(client: DbClient): Promise<string> {
  const dataset = createSyntheticDataset();
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

  const tasks = buildTasks(dataset.orders);
  await client.workflowTask.createMany({
    data: tasks.map((task) => ({
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
    data: MOCK_REMINDERS.map((reminder) => ({
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

  // The SPR numbers the mock answers use, so the database and the screens agree.
  const records = Object.entries(MOCK_SPR_REFS).flatMap(([orderNo, ref]) => {
    const parsed = parseRecordNumber(ref.recordNo);
    return parsed
      ? [
          {
            orderNo,
            ref,
            type: parsed.type,
            day: parsed.date,
            sequence: parsed.sequence,
          },
        ]
      : [];
  });
  await client.workflowRecord.createMany({
    data: records.map(({ orderNo, ref, type }) => ({
      id: mockId(520_000 + Number(orderNo.slice(3))),
      recordNo: ref.recordNo,
      recordType: type,
      navisionNo: ref.navisionNo,
      instanceId: instanceIds.get(orderNo) ?? null,
    })),
    skipDuplicates: true,
  });
  const highest = new Map<
    string,
    { type: RecordType; day: string; value: number }
  >();
  for (const { type, day, sequence } of records) {
    const key = `${type}-${day}`;
    const seen = highest.get(key);
    if (!seen || seen.value < sequence)
      highest.set(key, { type, day, value: sequence });
  }
  for (const { type, day, value } of highest.values()) {
    await client.recordCounter.upsert({
      where: { recordType_day: { recordType: type, day } },
      create: { recordType: type, day, lastValue: value },
      // Never move a counter backwards: a real number may have been taken.
      update: {},
    });
  }

  return `${String(instances.length)} sample orders, ${String(tasks.length)} tasks, ${String(MOCK_REMINDERS.length)} reminders, ${String(records.length)} SPR numbers and ${String(DEFAULT_DOCUMENT_CONFIG.length)} document types`;
}
