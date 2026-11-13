import { screenPath, type Direction } from "../../directions";
import { isBuilt } from "../../screens";

// Where a row on the home screen leads. A screen of the preview is used once it
// is built; until then the link goes to the same record in the real app, so
// nothing on the screen is a dead end.

/** An order's page: the preview's own screen takes the number as `?order=`. */
export function orderHref(direction: Direction, orderNo: string): string {
  return isBuilt("order")
    ? `${screenPath(direction, "order")}?order=${encodeURIComponent(orderNo)}`
    : `/order-tracker/${encodeURIComponent(orderNo)}`;
}

/** The orders list filtered to one step of the flow: `?step=` takes the tracker's step id. */
export function ordersHref(
  direction: Direction,
  stepId: string,
  statuses: readonly string[],
): string {
  return isBuilt("orders")
    ? `${screenPath(direction, "orders")}?step=${stepId}`
    : `/order-tracker?status=${statuses.join(",")}`;
}
