import { Inject, Injectable } from "@nestjs/common";
import type { SampleOrder } from "@orderpilot/synthetic-data";
import {
  SYNTHETIC_SOURCE,
  type DatasetSource,
} from "../../common/synthetic-source.js";
import { sampleStepFor } from "./domain/mock-status.js";
import type {
  OrderStatusReader,
  ReportedOrderStatus,
} from "./domain/order-status-reader.js";

function reportOf(order: SampleOrder): ReportedOrderStatus {
  const entry = sampleStepFor(order.sampleScreenState);
  return {
    orderNo: order.header.no,
    status: entry.status,
    ownerRole: entry.ownerRole,
    since: `${order.step.enteredOn}T08:00:00.000Z`,
    open: order.sampleScreenState !== "sample-closed",
  };
}

/**
 * Answers from the synthetic data's sample states. It stands in for area 2's
 * API: when that lands, a class that calls it replaces this one in
 * `ChecksModule`, and nothing else in area 3 changes.
 */
@Injectable()
export class MockOrderStatusReader implements OrderStatusReader {
  constructor(
    @Inject(SYNTHETIC_SOURCE) private readonly source: DatasetSource,
  ) {}

  statusOf(orderNo: string): Promise<ReportedOrderStatus | null> {
    const order = this.source().orders.find((o) => o.header.no === orderNo);
    return Promise.resolve(order ? reportOf(order) : null);
  }

  statusOfMany(
    orderNos: readonly string[],
  ): Promise<ReadonlyMap<string, ReportedOrderStatus>> {
    const wanted = new Set(orderNos);
    const found = new Map<string, ReportedOrderStatus>();
    for (const order of this.source().orders) {
      if (!wanted.has(order.header.no)) continue;
      found.set(order.header.no, reportOf(order));
    }
    return Promise.resolve(found);
  }
}
