import { addDecimal } from "@orderpilot/shared";
import type { Item } from "./types.js";

function negate(value: string): string {
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

/**
 * What the stock can still cover, by the formula in prompt 002: Inventory,
 * minus Qty. on Sales Order, plus Qty. on Purch. Order. The data's stock
 * purchase requests follow it, and the API's suggestion uses the same one.
 */
export function availableStock(
  item: Pick<Item, "inventory" | "qtyOnSalesOrder" | "qtyOnPurchOrder">,
): string {
  return addDecimal(
    addDecimal(item.inventory, negate(item.qtyOnSalesOrder)),
    item.qtyOnPurchOrder,
  );
}
