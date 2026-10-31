import { Injectable } from "@nestjs/common";
import type {
  InboxRole,
  OrderFlow,
  WorkflowReminder,
  WorkflowTask,
} from "@orderpilot/shared";
import {
  createSyntheticDataset,
  type SyntheticDataset,
} from "@orderpilot/synthetic-data";
import { MOCK_REMINDERS } from "./mock/mock-reminders.js";
import { buildFlow } from "./mock/mock-flows.js";
import { buildSprs, type SprRecord } from "./mock/mock-sprs.js";
import { buildTasks } from "./mock/mock-tasks.js";
import { WorkflowReadModel } from "./workflow-read-model.js";

/** Typed answers built from the synthetic dataset. Nothing here reads or writes the database. */
@Injectable()
export class MockWorkflowReadModel extends WorkflowReadModel {
  private readonly dataset: SyntheticDataset = createSyntheticDataset();
  private readonly tasks: readonly WorkflowTask[] = buildTasks(
    this.dataset.orders,
  );
  private readonly sprs: readonly SprRecord[] = buildSprs(this.dataset);

  tasksFor(role: InboxRole): Promise<WorkflowTask[]> {
    return Promise.resolve(
      this.tasks.filter((task) => task.assigneeRole === role),
    );
  }

  flowOf(orderNo: string): Promise<OrderFlow | null> {
    const order = this.dataset.orders.find(
      (entry) => entry.header.no === orderNo,
    );
    if (!order) return Promise.resolve(null);
    const customer = this.dataset.customers.find(
      (entry) => entry.no === order.header.sellToCustomerNo,
    );
    return Promise.resolve(
      buildFlow(order, customer?.name ?? order.header.sellToCustomerNo),
    );
  }

  sprByRecordNo(recordNo: string): Promise<SprRecord | null> {
    return Promise.resolve(
      this.sprs.find((spr) => spr.ref.recordNo === recordNo) ?? null,
    );
  }

  remindersFor(role: InboxRole): Promise<WorkflowReminder[]> {
    return Promise.resolve(
      MOCK_REMINDERS.filter((reminder) => reminder.toRole === role),
    );
  }
}
