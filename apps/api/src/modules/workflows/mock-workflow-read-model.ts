import { Inject, Injectable, Optional } from "@nestjs/common";
import type {
  InboxRole,
  OrderFlow,
  WorkflowReminder,
  WorkflowTask,
} from "@orderpilot/shared";
import type { SyntheticDataset } from "@orderpilot/synthetic-data";
import {
  SYNTHETIC_SOURCE,
  currentDataset,
  type DatasetSource,
} from "../../common/synthetic-source.js";
import { buildFlow } from "./mock/mock-flows.js";
import { buildSprs, type SprRecord } from "./mock/mock-sprs.js";
import { WorkflowReadModel } from "./workflow-read-model.js";

interface View {
  readonly dataset: SyntheticDataset;
  readonly sprs: ReadonlyMap<string, SprRecord>;
  readonly orders: ReadonlyMap<string, SyntheticDataset["orders"][number]>;
  readonly customers: ReadonlyMap<string, string>;
}

/**
 * Typed answers built from the synthetic dataset. Nothing here reads or writes
 * the database. It looks the dataset up on each call (it is built once a day),
 * and rebuilds its indexes only when the day, and so the set, has changed.
 */
@Injectable()
export class MockWorkflowReadModel extends WorkflowReadModel {
  private cached: View | null = null;

  constructor(
    @Optional()
    @Inject(SYNTHETIC_SOURCE)
    private readonly source: DatasetSource = currentDataset,
  ) {
    super();
  }

  private view(): View {
    const dataset = this.source();
    if (this.cached?.dataset !== dataset) {
      this.cached = {
        dataset,
        sprs: new Map(buildSprs(dataset).map((spr) => [spr.ref.recordNo, spr])),
        orders: new Map(dataset.orders.map((o) => [o.header.no, o])),
        customers: new Map(dataset.customers.map((c) => [c.no, c.name])),
      };
    }
    return this.cached;
  }

  tasksFor(role: InboxRole): Promise<WorkflowTask[]> {
    return Promise.resolve(
      this.view().dataset.tasks.filter((task) => task.assigneeRole === role),
    );
  }

  flowOf(orderNo: string): Promise<OrderFlow | null> {
    const { dataset, orders, customers } = this.view();
    const order = orders.get(orderNo);
    if (!order) return Promise.resolve(null);
    return Promise.resolve(
      buildFlow(
        order,
        customers.get(order.header.sellToCustomerNo) ??
          order.header.sellToCustomerNo,
        dataset.payments,
        dataset.asOf,
      ),
    );
  }

  sprByRecordNo(recordNo: string): Promise<SprRecord | null> {
    return Promise.resolve(this.view().sprs.get(recordNo) ?? null);
  }

  remindersFor(role: InboxRole): Promise<WorkflowReminder[]> {
    return Promise.resolve(
      this.view().dataset.reminders.filter(
        (reminder) => reminder.toRole === role,
      ),
    );
  }
}
