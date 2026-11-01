import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import { addDays } from "./dates.js";
import type {
  Item,
  PurchaseLine,
  PurchaseOrder,
  SampleOrder,
  SampleSpr,
} from "./types.js";

const LINES_PER_ORDER = 5;

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
    // An order cannot ship goods that are still on their way, so the purchase
    // order behind a shipped line has arrived and nothing is outstanding.
    const received = orders
      .find((order) => order.header.no === spr.orderNo)
      ?.lines.some(
        (line) => line.no === item.no && Number(line.quantityShipped) > 0,
      );
    const lines = [lineOf(item, spr.quantity, received === true)];
    return [
      {
        no: spr.navisionNo,
        buyFromVendorNo: spr.vendorNo,
        orderDate: raised,
        expectedReceiptDate: workingDay(
          received
            ? addDays(raised, 7 + (index % 5))
            : addDays(reference, 4 + (index % 12)),
        ),
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
 * The purchase orders, derived rather than invented: each approved SPR's
 * Navision number is one, and whatever is on order that no SPR explains goes
 * into further orders in the same number series.
 *
 * It raises Qty. on Purch. Order by each open SPR order, because that quantity
 * is on its way as soon as the SPR is posted. An SPR's `basis` keeps the
 * figures from when it was raised, so it stays what the approver saw. Uses no
 * random numbers, so the data made after it does not move.
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
  const further = fromStockFigures(items, highest + 1, reference);
  for (const po of posted) {
    for (const line of po.lines) {
      const item = items.find((candidate) => candidate.no === line.no);
      if (item && po.status === "open")
        item.qtyOnPurchOrder = String(
          Number(item.qtyOnPurchOrder) + Number(line.outstandingQuantity),
        );
    }
  }
  return [...posted, ...further];
}
