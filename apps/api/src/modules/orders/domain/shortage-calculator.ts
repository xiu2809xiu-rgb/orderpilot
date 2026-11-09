import {
  compareDecimal,
  shortfallOf,
  sumDecimal,
  type SalesOrderShortage,
} from "@orderpilot/shared";
import type { OrderFactsLine } from "./order-facts.js";

/**
 * Where a stored order falls short of stock. Lines are summed per item first,
 * so two lines for one item are judged together. Each order stands alone: it
 * never takes stock from another stored order, because a draft is not demand
 * (ADR 0046).
 */
export class ShortageCalculator {
  /** `stock` maps an item's number to its available stock. */
  constructor(private readonly stock: ReadonlyMap<string, string>) {}

  /** One entry per short item, the largest gap first, ties by item number. */
  of(lines: readonly OrderFactsLine[]): SalesOrderShortage[] {
    const wanted = new Map<string, string[]>();
    for (const line of lines) {
      const quantities = wanted.get(line.itemNo) ?? [];
      quantities.push(line.quantity);
      wanted.set(line.itemNo, quantities);
    }
    const short: SalesOrderShortage[] = [];
    for (const [itemNo, quantities] of wanted) {
      const availableStock = this.stock.get(itemNo);
      // An item Business Central does not know has no figure to fall short of.
      if (availableStock === undefined) continue;
      const ordered = sumDecimal(quantities);
      const shortBy = shortfallOf(ordered, availableStock);
      if (shortBy !== null)
        short.push({ itemNo, ordered, availableStock, shortBy });
    }
    return short.sort(
      (a, b) =>
        compareDecimal(b.shortBy, a.shortBy) ||
        a.itemNo.localeCompare(b.itemNo),
    );
  }
}
