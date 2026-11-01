import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import { addDays, atHour } from "./dates.js";
import type { Journey } from "./journey.js";
import type { RecordNumberer } from "./records.js";
import { availableStock } from "./stock.js";
import type { Item, SampleOrder, SampleSpr } from "./types.js";

const NOTES = [
  "",
  "Keeps the safety stock for the distributor accounts.",
  "The vendor confirmed the lead time by email.",
  "",
  "Part of a larger container for the same vendor.",
] as const;

const COMMENTS = [
  "Within my limit and the vendor confirmed the lead time.",
  "Approved. Please book the freight early.",
  "Fine for the order, and the price is in line with the last one.",
  "Approved, with the delivery date as requested.",
] as const;

function negate(value: string): string {
  return value.startsWith("-") ? value.slice(1) : `-${value}`;
}

/**
 * One stock purchase request for every order that wants more than the stock
 * covers. The quantity is the shortfall by prompt 002's formula (available
 * stock is Inventory minus Qty. on Sales Order plus Qty. on Purch. Order).
 * Where the order stands decides the request's status: suggested while the
 * product manager reviews, submitted while the approver has it, approved after.
 */
export function makeSprs(
  orders: readonly SampleOrder[],
  journeys: readonly Journey[],
  items: readonly Item[],
  numberer: RecordNumberer,
): SampleSpr[] {
  const sprs: SampleSpr[] = [];
  let purchaseOrder = 20;
  orders.forEach((order, index) => {
    const journey = journeys[index];
    const shortfall = order.stockShortfall;
    const item = items.find((it) => it.no === shortfall?.itemNo);
    if (!journey || !shortfall || !item) return;
    const approved = journey.done.approved !== undefined;
    const requestedOn =
      journey.done.stock ??
      (journey.state === "sample-short-stock"
        ? journey.enteredOn
        : order.header.orderDate);
    const status =
      journey.state === "sample-short-stock"
        ? ("suggested" as const)
        : approved
          ? ("approved" as const)
          : ("submitted" as const);
    const available = availableStock(item);
    const quantity = addDecimal(shortfall.ordered, negate(available));
    const decidedOn = journey.done.approved;
    sprs.push({
      recordNo: numberer.next("SPR", requestedOn),
      navisionNo:
        status === "approved"
          ? `PO-${String(++purchaseOrder).padStart(4, "0")}`
          : null,
      orderNo: order.header.no,
      status,
      itemNo: item.no,
      vendorNo: item.vendorNo,
      requestedBy: order.owners.productManager,
      requestedAt: atHour(requestedOn, 3),
      quantity,
      unitCost: item.unitCost,
      amount: multiplyDecimal(quantity, item.unitCost),
      needBy: addDays(requestedOn, 14),
      notes: NOTES[index % NOTES.length] ?? "",
      basis: {
        ordered: shortfall.ordered,
        inventory: item.inventory,
        qtyOnSalesOrder: item.qtyOnSalesOrder,
        qtyOnPurchOrder: item.qtyOnPurchOrder,
        availableStock: available,
        shortfall: quantity,
      },
      decision:
        status === "approved" && decidedOn
          ? {
              outcome: "approved",
              by: order.owners.approver,
              comment: COMMENTS[index % COMMENTS.length] ?? "",
              // Same day: some hours later. Next day: early the morning after.
              at: atHour(
                decidedOn,
                decidedOn === requestedOn ? 7 + (index % 3) : 2 + (index % 4),
              ),
            }
          : null,
    });
  });
  return sprs;
}
