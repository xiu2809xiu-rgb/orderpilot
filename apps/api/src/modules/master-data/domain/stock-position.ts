import {
  addDecimal,
  compareDecimal,
  type ItemAvailability,
} from "@orderpilot/shared";
import type {
  MasterDataItem,
  MasterDataSalesOrder,
} from "./master-data-reader.js";

/** Under this much available stock an item counts as low. A sample for the demo. */
export const LOW_STOCK_THRESHOLD = "25";

const negate = (value: string): string =>
  value.startsWith("-") ? value.slice(1) : `-${value}`;

/** Still something to ship. This is what "open" means on every master data page. */
export function isOpenOrder(order: MasterDataSalesOrder): boolean {
  return order.lines.some((line) => compareDecimal(line.qtyToShip, "0") > 0);
}

/**
 * Stock facts about one item. Pure, so the rule that decides "short" is tested
 * on its own. A short line stays out of Qty. on Sales Order while its SPR
 * waits, as the demand under review, which leaves available stock positive
 * even for an item that cannot cover its orders. So "short" is read from the
 * open orders' shortfalls, and never from the sign of available stock. Once
 * the SPR is approved the line is ordinary demand, counted like any other.
 */
export class StockPosition {
  constructor(
    private readonly item: Pick<
      MasterDataItem,
      "no" | "inventory" | "qtyOnSalesOrder" | "qtyOnPurchOrder"
    >,
    private readonly orders: readonly MasterDataSalesOrder[],
  ) {}

  /** Inventory minus Qty. on Sales Order plus Qty. on Purch. Order. */
  get availableStock(): string {
    return addDecimal(
      addDecimal(this.item.inventory, negate(this.item.qtyOnSalesOrder)),
      this.item.qtyOnPurchOrder,
    );
  }

  /** True when this open order's short line for the item waits on its SPR. */
  isHeldOut(order: MasterDataSalesOrder): boolean {
    return (
      isOpenOrder(order) &&
      order.stockShortfall?.itemNo === this.item.no &&
      order.stockShortfall.coveredBy === null
    );
  }

  /** True when this open order wants more of the item than is available. */
  isShortOn(order: MasterDataSalesOrder): boolean {
    return (
      this.isHeldOut(order) &&
      compareDecimal(
        order.stockShortfall?.ordered ?? "0",
        this.availableStock,
      ) > 0
    );
  }

  get availability(): ItemAvailability {
    if (this.orders.some((order) => this.isShortOn(order))) return "short";
    return compareDecimal(this.availableStock, LOW_STOCK_THRESHOLD) < 0
      ? "low"
      : "ok";
  }
}
