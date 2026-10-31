import { Inject, Injectable } from "@nestjs/common";
import type { SyntheticDataset } from "@orderpilot/synthetic-data";
import { sampleStepFor } from "./domain/mock-status.js";
import type {
  OrderStatusReader,
  ReportedOrderStatus,
} from "./domain/order-status-reader.js";
import { SYNTHETIC_DATASET } from "./synthetic-dataset.js";

/**
 * Answers from the synthetic data's sample states. It stands in for area 2's
 * API: when that lands, a class that calls it replaces this one in
 * `ChecksModule`, and nothing else in area 3 changes.
 */
@Injectable()
export class MockOrderStatusReader implements OrderStatusReader {
  constructor(
    @Inject(SYNTHETIC_DATASET) private readonly dataset: SyntheticDataset,
  ) {}

  statusOf(orderNo: string): Promise<ReportedOrderStatus | null> {
    const order = this.dataset.orders.find((o) => o.header.no === orderNo);
    if (!order) return Promise.resolve(null);
    const entry = sampleStepFor(order.sampleScreenState);
    return Promise.resolve({
      orderNo,
      status: entry.status,
      ownerRole: entry.ownerRole,
      since: `${order.header.orderDate}T08:00:00.000Z`,
    });
  }

  async statusOfMany(
    orderNos: readonly string[],
  ): Promise<ReadonlyMap<string, ReportedOrderStatus>> {
    const found = new Map<string, ReportedOrderStatus>();
    for (const orderNo of orderNos) {
      const status = await this.statusOf(orderNo);
      if (status) found.set(orderNo, status);
    }
    return found;
  }
}
