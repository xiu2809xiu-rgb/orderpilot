import { compareDecimal, type SalesOrderQuery } from "@orderpilot/shared";
import type { OrderEntry } from "./order-entry.js";

type Column = NonNullable<SalesOrderQuery["sort"]>;

const text = (a: string, b: string): number =>
  a.localeCompare(b, "en", { numeric: true });

const COMPARE: Record<Column, (a: OrderEntry, b: OrderEntry) => number> = {
  orderNo: (a, b) => text(a.facts.orderNo, b.facts.orderNo),
  customerNo: (a, b) => text(a.facts.customerNo, b.facts.customerNo),
  orderDate: (a, b) => text(a.facts.orderDate, b.facts.orderDate),
  shipmentDate: (a, b) =>
    text(a.facts.shipmentDate ?? "", b.facts.shipmentDate ?? ""),
  amount: (a, b) => compareDecimal(a.facts.total, b.facts.total),
  captureState: (a, b) =>
    text(a.facts.captureState ?? "", b.facts.captureState ?? ""),
};

/**
 * The order of the Orders list: newest first unless asked, then by number.
 *
 * A sort by amount falls back to the default when the role cannot see
 * amounts, because the order of hidden values would give them away.
 */
export function sortOrders(
  entries: readonly OrderEntry[],
  query: Pick<SalesOrderQuery, "sort" | "direction">,
  canSeeAmount: boolean,
): OrderEntry[] {
  const requested = query.sort;
  const fellBack =
    requested === undefined || (requested === "amount" && !canSeeAmount);
  const column: Column = fellBack ? "orderDate" : requested;
  // The default is newest first, and a fallback keeps it: asking for the
  // hidden column must not look different from asking for nothing.
  const direction = query.direction ?? (fellBack ? "desc" : "asc");
  const sign = direction === "desc" ? -1 : 1;
  // The number breaks every tie the same way, so paging never repeats a row.
  return [...entries].sort(
    (a, b) =>
      sign * COMPARE[column](a, b) || text(a.facts.orderNo, b.facts.orderNo),
  );
}
