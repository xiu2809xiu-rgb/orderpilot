import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import { addDays } from "./dates.js";
import {
  SAMPLE_SCREEN_STATES,
  type Item,
  type PurchaseLine,
  type PurchaseOrder,
  type SampleOrder,
  type SampleSpr,
} from "./types.js";

const LINES_PER_ORDER = 5;

/** From here on the warehouse picks, so the goods must be in hand. */
const PICKING = SAMPLE_SCREEN_STATES.indexOf("sample-ready-to-pick");

const pad = (n: number): string => String(n).padStart(4, "0");

/** Saturdays and Sundays move to the Monday: nobody issues or receives a PO then. */
function workingDay(date: string): string {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  if (day === 6) return addDays(date, 2);
  return day === 0 ? addDays(date, 1) : date;
}

function lineOf(item: Item, quantity: string, received: boolean): PurchaseLine {
  return {
    no: item.no,
    description: item.description,
    quantity,
    outstandingQuantity: received ? "0" : quantity,
    unitCost: item.unitCost,
    lineAmount: multiplyDecimal(quantity, item.unitCost),
  };
}

function totalOf(lines: readonly PurchaseLine[]): string {
  return lines.reduce((sum, line) => addDecimal(sum, line.lineAmount), "0.00");
}

/** Stock figures are whole units, written without decimals as the catalogue writes them. */
const plus = (...quantities: readonly string[]): string =>
  String(quantities.reduce((sum, quantity) => sum + Number(quantity), 0));

const rankOf = (order: SampleOrder | undefined): number =>
  order ? SAMPLE_SCREEN_STATES.indexOf(order.sampleScreenState) : -1;

/** The purchase orders that approved SPRs became, in SPR order. */
function fromSprs(
  sprs: readonly SampleSpr[],
  items: readonly Item[],
  orders: readonly SampleOrder[],
  reference: string,
): PurchaseOrder[] {
  return sprs.flatMap((spr, index): PurchaseOrder[] => {
    const item = items.find((candidate) => candidate.no === spr.itemNo);
    if (!spr.navisionNo || !spr.decision || !item) return [];
    const raised = spr.decision.at.slice(0, 10);
    const order = orders.find((o) => o.header.no === spr.orderNo);
    // The warehouse cannot pick goods that are still on their way, so the
    // purchase order behind an order at picking or later has arrived, before
    // the customer paid.
    const received = rankOf(order) >= PICKING;
    const paid = order?.milestones.paid;
    const due = workingDay(addDays(raised, 3 + (index % 3)));
    const lines = [lineOf(item, spr.quantity, received)];
    return [
      {
        no: spr.navisionNo,
        buyFromVendorNo: spr.vendorNo,
        orderDate: raised,
        expectedReceiptDate: received
          ? paid && due > paid
            ? paid
            : due
          : workingDay(addDays(reference, 4 + (index % 12))),
        currencyCode: "USD",
        status: received ? "received" : "open",
        sprRecordNo: spr.recordNo,
        lines,
        total: totalOf(lines),
      },
    ];
  });
}

/**
 * What the base figure of Qty. on Purch. Order holds: orders no SPR explains,
 * up to five items to an order, vendor by vendor.
 */
function fromStockFigures(
  items: readonly Item[],
  firstNumber: number,
  reference: string,
): PurchaseOrder[] {
  const byVendor = new Map<string, Item[]>();
  for (const item of items) {
    if (Number(item.qtyOnPurchOrder) <= 0) continue;
    byVendor.set(item.vendorNo, [...(byVendor.get(item.vendorNo) ?? []), item]);
  }
  const purchaseOrders: PurchaseOrder[] = [];
  for (const [vendorNo, supplied] of byVendor) {
    for (let at = 0; at < supplied.length; at += LINES_PER_ORDER) {
      const n = purchaseOrders.length;
      const lines = supplied
        .slice(at, at + LINES_PER_ORDER)
        .map((item) => lineOf(item, item.qtyOnPurchOrder, false));
      purchaseOrders.push({
        no: `PO-${pad(firstNumber + n)}`,
        buyFromVendorNo: vendorNo,
        orderDate: workingDay(addDays(reference, -(3 + ((n * 5) % 34)))),
        expectedReceiptDate: workingDay(addDays(reference, 3 + ((n * 7) % 37))),
        currencyCode: "USD",
        status: "open",
        sprRecordNo: null,
        lines,
        total: totalOf(lines),
      });
    }
  }
  return purchaseOrders;
}

/**
 * Moves the stock figures on from when each approved SPR was raised, for the
 * orders still to ship:
 *
 * - the short line joins Qty. on Sales Order, because once the approver has
 *   said yes it is ordinary demand, no longer under review;
 * - an SPR order still on its way joins Qty. on Purch. Order;
 * - one that has arrived joins Inventory, and so does what was on order when
 *   the SPR was raised, which the SPR counted on and which came first.
 *
 * Shipped orders change nothing: their goods came in and went out again.
 */
function settleStock(
  posted: readonly PurchaseOrder[],
  sprs: readonly SampleSpr[],
  items: readonly Item[],
  orders: readonly SampleOrder[],
): void {
  for (const po of posted) {
    const spr = sprs.find((candidate) => candidate.navisionNo === po.no);
    const order = orders.find((o) => o.header.no === spr?.orderNo);
    const item = items.find((candidate) => candidate.no === spr?.itemNo);
    const short = order?.lines.find((line) => line.no === item?.no);
    if (!spr || !item || !short || Number(short.qtyToShip) <= 0) continue;
    item.qtyOnSalesOrder = plus(item.qtyOnSalesOrder, short.qtyToShip);
    if (po.status === "open") {
      item.qtyOnPurchOrder = plus(item.qtyOnPurchOrder, spr.quantity);
    } else {
      item.inventory = plus(item.inventory, item.qtyOnPurchOrder, spr.quantity);
      item.qtyOnPurchOrder = "0";
    }
  }
}

/**
 * The purchase orders, derived rather than invented: each approved SPR's
 * Navision number is one, and whatever is on order that no SPR explains goes
 * into further orders in the same number series.
 *
 * It also moves the items' stock figures on from when the SPRs were raised
 * (see `settleStock`). An SPR's `basis` keeps the figures from then, so it
 * stays what the approver saw. Uses no random numbers, so the data made after
 * it does not move.
 */
export function makePurchaseOrders(
  sprs: readonly SampleSpr[],
  items: readonly Item[],
  orders: readonly SampleOrder[],
  reference: string,
): PurchaseOrder[] {
  const posted = fromSprs(sprs, items, orders, reference);
  const highest = posted.reduce(
    (top, po) => Math.max(top, Number(po.no.slice(3))),
    20,
  );
  // Received stock leaves Qty. on Purch. Order before the further orders are
  // made from it, and SPR orders still open join it only after, so that no
  // quantity sits on two purchase orders.
  const received = posted.filter((po) => po.status === "received");
  settleStock(received, sprs, items, orders);
  const further = fromStockFigures(items, highest + 1, reference);
  settleStock(
    posted.filter((po) => po.status === "open"),
    sprs,
    items,
    orders,
  );
  return [...posted, ...further];
}
