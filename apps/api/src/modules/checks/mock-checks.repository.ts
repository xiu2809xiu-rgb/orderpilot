import { Inject, Injectable } from "@nestjs/common";
import type { CheckException } from "@orderpilot/shared";
import type {
  Customer,
  Item,
  SampleOrder,
  SyntheticDataset,
} from "@orderpilot/synthetic-data";
import { mockExceptions } from "./domain/mock-samples.js";
import { SYNTHETIC_DATASET } from "./synthetic-dataset.js";

/**
 * The mock data source behind the tracker and the exceptions queue: the
 * synthetic data, read-only. Services depend on this class and never on the
 * dataset, so a real repository (Prisma, over the read model and the
 * `CheckException` table) replaces it without touching them.
 */
@Injectable()
export class MockChecksRepository {
  constructor(
    @Inject(SYNTHETIC_DATASET) private readonly dataset: SyntheticDataset,
  ) {}

  orders(): readonly SampleOrder[] {
    return this.dataset.orders;
  }

  findOrder(orderNo: string): SampleOrder | undefined {
    return this.dataset.orders.find((o) => o.header.no === orderNo);
  }

  customers(): readonly Customer[] {
    return this.dataset.customers;
  }

  items(): readonly Item[] {
    return this.dataset.items;
  }

  customerName(customerNo: string): string {
    return (
      this.dataset.customers.find((c) => c.no === customerNo)?.name ??
      customerNo
    );
  }

  exceptions(): readonly CheckException[] {
    return mockExceptions(this.dataset.orders, this.dataset.customers);
  }
}
