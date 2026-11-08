import type { SalesOrderShortage } from "@orderpilot/shared";
import type { OrderFacts } from "./order-facts.js";

/**
 * An order with what the list needs beside its facts: the items it falls
 * short on, largest gap first. An order is "waiting on stock" when this is
 * not empty.
 */
export interface OrderEntry {
  readonly facts: OrderFacts;
  readonly shortages: readonly SalesOrderShortage[];
}
