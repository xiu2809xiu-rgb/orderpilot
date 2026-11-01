import { Inject, Injectable } from "@nestjs/common";
import {
  SYNTHETIC_SOURCE,
  type DatasetSource,
} from "../../common/synthetic-source.js";
import { sampleStepFor } from "./domain/mock-status.js";
import type {
  OrderStatusReader,
  ReportedOrderStatus,
} from "./domain/order-status-reader.js";

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
    if (!order) return Promise.resolve(null);
    const entry = sampleStepFor(order.sampleScreenState);
    return Promise.resolve({
      orderNo,
      status: entry.status,
      ownerRole: entry.ownerRole,
      since: `${order.step.enteredOn}T08:00:00.000Z`,
    });
  }

  statusOfMany(
    orderNos: readonly string[],
  ): Promise<ReadonlyMap<string, ReportedOrderStatus>> {
    const wanted = new Set(orderNos);
    const found = new Map<string, ReportedOrderStatus>();
    for (const order of this.source().orders) {
      if (!wanted.has(order.header.no)) continue;
      const entry = sampleStepFor(order.sampleScreenState);
      found.set(order.header.no, {
        orderNo: order.header.no,
        status: entry.status,
        ownerRole: entry.ownerRole,
        since: `${order.step.enteredOn}T08:00:00.000Z`,
      });
    }
    return Promise.resolve(found);
  }
}
