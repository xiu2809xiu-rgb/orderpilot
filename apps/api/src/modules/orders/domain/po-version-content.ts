import { sumDecimal } from "@orderpilot/shared";
import type { SalesOrderLineInput } from "./sales-order.js";
import { SalesOrderLine, type SalesOrder } from "./sales-order.js";

/**
 * What one PO version holds, as text and in the shape the database gives it
 * back, so the head and a copy compare equal when they hold the same thing:
 * quantities with three decimals, prices and the percent with two.
 */
export interface PoVersionContent {
  readonly orderDate: string;
  readonly shipmentDate: string | null;
  readonly currencyCode: string;
  readonly prepaymentPercent: string;
  readonly lines: readonly SalesOrderLineInput[];
}

export interface NumberedPoVersionContent extends PoVersionContent {
  readonly poVersionNo: number;
}

const QUANTITY_PLACES = 3;
const MONEY_PLACES = 2;

/**
 * A decimal string as `Decimal.toFixed(places)` writes it, so "007" is "7.000",
 * "0.5" is "0.500", "5.10" stays and "030" is "30.00" at two places. It pads and
 * never rounds: a digit past the places that is not zero is a RangeError, and
 * the body's patterns already refuse one.
 */
export function padDecimal(value: string, places: number): string {
  const negative = value.startsWith("-");
  const [whole = "0", fraction = ""] = value.replace("-", "").split(".");
  if (/[1-9]/.test(fraction.slice(places)))
    throw new RangeError(`More than ${String(places)} decimals: ${value}`);
  const digits = whole.replace(/^0+(?=\d)/, "");
  const text = `${digits === "" ? "0" : digits}.${fraction.slice(0, places).padEnd(places, "0")}`;
  return negative && /[1-9]/.test(text) ? `-${text}` : text;
}

/** The content of an order's current version. */
export function contentOf(order: SalesOrder): PoVersionContent {
  return {
    orderDate: order.orderDate,
    shipmentDate: order.shipmentDate,
    currencyCode: order.currencyCode,
    prepaymentPercent: padDecimal(order.prepaymentPercent, MONEY_PLACES),
    lines: order.lines.map((line) => ({
      lineNo: line.lineNo,
      itemNo: line.itemNo,
      description: line.description,
      quantity: padDecimal(line.quantity, QUANTITY_PLACES),
      unitPrice: padDecimal(line.unitPrice, MONEY_PLACES),
      qtyToShip: padDecimal(line.qtyToShip, QUANTITY_PLACES),
    })),
  };
}

/**
 * The total of a version, from its lines through the getter that
 * `SalesOrder.total` sums, so there is never a second formula for it.
 */
export function contentTotal(content: PoVersionContent): string {
  return sumDecimal(
    content.lines.map((line) => new SalesOrderLine(line).amount),
  );
}
