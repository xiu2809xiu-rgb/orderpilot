import { Inject, Injectable } from "@nestjs/common";
import { parseRecordNumber } from "@orderpilot/shared";
import type {
  OrderDirectory,
  OrderFactsSource,
  OrderListOptions,
} from "../domain/order-directory.js";
import type { OrderFacts } from "../domain/order-facts.js";
import { SampleOrderSource } from "./sample-order-source.js";
import { StoredOrderSource } from "./stored-order-source.js";

/** Samples first, then the stored orders. */
@Injectable()
export class CompositeOrderDirectory implements OrderDirectory {
  constructor(
    @Inject(SampleOrderSource) private readonly samples: OrderFactsSource,
    @Inject(StoredOrderSource) private readonly stored: OrderFactsSource,
  ) {}

  async list(options: OrderListOptions = {}): Promise<readonly OrderFacts[]> {
    // A kind that was not asked for is not read: the stored read is a query.
    const [samples, stored] = await Promise.all([
      options.source === "stored" ? [] : this.samples.list(),
      options.source === "sample" ? [] : this.stored.list(),
    ]);
    return [...samples, ...stored];
  }

  find(orderNo: string): Promise<OrderFacts | null> {
    // A parse, not a prefix test: `SO-0001` is a sample and
    // `SO-20261108-0001` is a stored order, though both start with `SO-`.
    return parseRecordNumber(orderNo) === null
      ? this.samples.find(orderNo)
      : this.stored.find(orderNo);
  }
}
