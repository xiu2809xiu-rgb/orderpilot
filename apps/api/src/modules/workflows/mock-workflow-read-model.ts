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
import { MockDecisionOverlay } from "./mock/mock-decision-overlay.js";
import { buildFlow } from "./mock/mock-flows.js";
import { buildSprs, type SprRecord } from "./mock/mock-sprs.js";
import { WorkflowReadModel } from "./workflow-read-model.js";

interface View {
  readonly dataset: SyntheticDataset;
  readonly tasks: readonly WorkflowTask[];
  readonly sprs: ReadonlyMap<string, SprRecord>;
  readonly orders: ReadonlyMap<string, SyntheticDataset["orders"][number]>;
  readonly customers: ReadonlyMap<string, string>;
}

/** What an SPR task would buy, from the SPR it is about. */
function sprSummaryOf(spr: SprRecord): NonNullable<WorkflowTask["spr"]> {
  return {
    itemNo: spr.item.no,
    itemDescription: spr.item.description,
    quantity: spr.quantity,
    monthsOfCover: spr.basis.monthsOfCover,
  };
}

/**
 * Each payment task carries what one click confirms: the fixture's type and
 * amount. Each SPR task carries what the SPR would buy.
 */
function tasksOf(
  dataset: SyntheticDataset,
  sprs: ReadonlyMap<string, SprRecord>,
): WorkflowTask[] {
  return dataset.tasks.map((task) => {
    const spr = task.ref ? sprs.get(task.ref.recordNo) : undefined;
    if (task.kind === "APPROVE_SPR" && spr) {
      return { ...task, spr: sprSummaryOf(spr) };
    }
    if (task.kind !== "CONFIRM_PAYMENT") return task;
    const due = dataset.payments.find(
      (p) => p.orderNo === task.orderNo && p.status === "expected",
    );
    return due
      ? {
          ...task,
          expectedPayment: {
            paymentType: due.paymentType,
            amount: due.amount,
            currencyCode: due.currencyCode,
          },
        }
      : task;
  });
}

/**
 * Typed answers built from the synthetic dataset. Nothing here reads or writes
 * the database. It looks the dataset up on each call (it is built once a day),
 * and rebuilds its indexes only when the day, and so the set, has changed. What
 * people did to the mock tasks comes from the `MockDecisionOverlay`.
 */
@Injectable()
export class MockWorkflowReadModel extends WorkflowReadModel {
  private cached: View | null = null;

  constructor(
    @Optional()
    @Inject(SYNTHETIC_SOURCE)
    private readonly source: DatasetSource = currentDataset,
    @Optional()
    @Inject(MockDecisionOverlay)
    private readonly overlay: MockDecisionOverlay = new MockDecisionOverlay(),
  ) {
    super();
  }

  private view(): View {
    const dataset = this.source();
    if (this.cached?.dataset !== dataset) {
      this.overlay.startDay(dataset.asOf);
      const sprs = new Map(
        buildSprs(dataset).map((spr) => [spr.ref.recordNo, spr]),
      );
      this.cached = {
        dataset,
        tasks: tasksOf(dataset, sprs),
        sprs,
        orders: new Map(dataset.orders.map((o) => [o.header.no, o])),
        customers: new Map(dataset.customers.map((c) => [c.no, c.name])),
      };
    }
    return this.cached;
  }

  tasksFor(role: InboxRole): Promise<WorkflowTask[]> {
    return Promise.resolve(
      this.view().tasks.filter(
        (task) => task.assigneeRole === role && !this.overlay.isClosed(task.id),
      ),
    );
  }

  taskById(id: string): Promise<WorkflowTask | null> {
    return Promise.resolve(
      this.view().tasks.find((task) => task.id === id) ?? null,
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
        this.overlay.paymentsOf(orderNo),
      ),
    );
  }

  sprByRecordNo(recordNo: string): Promise<SprRecord | null> {
    const spr = this.view().sprs.get(recordNo);
    if (!spr) return Promise.resolve(null);
    const decision = this.overlay.decisionOf(recordNo);
    return Promise.resolve(decision ? { ...spr, decision } : spr);
  }

  /**
   * A task the overlay has closed takes its reminder with it. A reminder about
   * a record, such as an SPR, carries its number so it opens that record, and
   * says what the SPR would buy, as its task does.
   */
  remindersFor(role: InboxRole): Promise<WorkflowReminder[]> {
    const { dataset, tasks } = this.view();
    const mine = tasks.filter((t) => t.assigneeRole === role);
    const closedOrders = new Set(
      mine.filter((t) => this.overlay.isClosed(t.id)).map((t) => t.orderNo),
    );
    const refs = new Map(
      mine.flatMap((t) => (t.ref && t.orderNo ? [[t.orderNo, t.ref]] : [])),
    );
    const sprs = new Map(
      mine.flatMap((t) => (t.spr && t.orderNo ? [[t.orderNo, t.spr]] : [])),
    );
    return Promise.resolve(
      dataset.reminders
        .filter(
          (reminder) =>
            reminder.toRole === role && !closedOrders.has(reminder.orderNo),
        )
        .map((reminder) => {
          const spr = sprs.get(reminder.orderNo);
          return {
            ...reminder,
            ref: refs.get(reminder.orderNo) ?? null,
            ...(spr ? { spr } : {}),
          };
        }),
    );
  }
}
