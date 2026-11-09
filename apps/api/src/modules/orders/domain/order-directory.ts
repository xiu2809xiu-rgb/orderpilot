import type { OrderSource } from "@orderpilot/shared";
import type { OrderFacts } from "./order-facts.js";

/**
 * The one place that answers for an order, sample or stored. Whatever needs an
 * order's facts asks this, so a new order shows up wherever a sample does.
 */
export interface OrderDirectory {
  /**
   * Every order, samples first. A caller that wants one kind says so, so the
   * other kind is not read at all.
   */
  list(options?: OrderListOptions): Promise<readonly OrderFacts[]>;
  /** The order with this number, or null. */
  find(orderNo: string): Promise<OrderFacts | null>;
}

export interface OrderListOptions {
  readonly source?: OrderSource | undefined;
}

export const ORDER_DIRECTORY = Symbol("ORDER_DIRECTORY");

/** One half of the directory: where a kind of order is kept. */
export interface OrderFactsSource {
  list(): Promise<readonly OrderFacts[]>;
  find(orderNo: string): Promise<OrderFacts | null>;
}
