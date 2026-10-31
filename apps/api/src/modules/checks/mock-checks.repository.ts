import { Inject, Injectable } from "@nestjs/common";
import type { CheckException } from "@orderpilot/shared";
import type {
  Customer,
  Item,
  SampleOrder,
  SyntheticDataset,
} from "@orderpilot/synthetic-data";
import {
  SYNTHETIC_SOURCE,
  type DatasetSource,
} from "../../common/synthetic-source.js";
import { mockExceptions } from "./domain/mock-samples.js";

interface Indexes {
  readonly dataset: SyntheticDataset;
  readonly orders: ReadonlyMap<string, SampleOrder>;
  readonly customerNames: ReadonlyMap<string, string>;
  readonly exceptions: readonly CheckException[];
}

/**
 * The mock data source behind the tracker and the exceptions queue: the
 * synthetic data, read-only. Services depend on this class and never on the
 * dataset, so a real repository (Prisma, over the read model and the
 * `CheckException` table) replaces it without touching them. It looks the
 * dataset up on each call (it is built once a day) and re-indexes only when
 * the set changes.
 */
@Injectable()
export class MockChecksRepository {
  private cached: Indexes | null = null;

  constructor(
    @Inject(SYNTHETIC_SOURCE) private readonly source: DatasetSource,
  ) {}

  private indexes(): Indexes {
    const dataset = this.source();
    if (this.cached?.dataset !== dataset) {
      this.cached = {
        dataset,
        orders: new Map(dataset.orders.map((o) => [o.header.no, o])),
        customerNames: new Map(dataset.customers.map((c) => [c.no, c.name])),
        exceptions: mockExceptions(dataset.exceptions, dataset.customers),
      };
    }
    return this.cached;
  }

  /** The reference date the data counts "today" from. */
  asOf(): string {
    return this.indexes().dataset.asOf;
  }

  orders(): readonly SampleOrder[] {
    return this.indexes().dataset.orders;
  }

  findOrder(orderNo: string): SampleOrder | undefined {
    return this.indexes().orders.get(orderNo);
  }

  customers(): readonly Customer[] {
    return this.indexes().dataset.customers;
  }

  items(): readonly Item[] {
    return this.indexes().dataset.items;
  }

  customerName(customerNo: string): string {
    return this.indexes().customerNames.get(customerNo) ?? customerNo;
  }

  exceptions(): readonly CheckException[] {
    return this.indexes().exceptions;
  }
}
