import type { OrderEntry } from "./order-entry.js";
import type { OrderFacts } from "./order-facts.js";

/** An order for unit tests: a stored draft of one line, with every field overridable. */
export function facts(patch: Partial<OrderFacts> = {}): OrderFacts {
  return {
    orderNo: "SO-20261108-0001",
    source: "stored",
    captureState: "draft",
    customerNo: "C-0001",
    customerName: null,
    externalDocumentNo: "PO-1",
    orderDate: "2026-11-08",
    shipmentDate: null,
    currencyCode: "USD",
    prepaymentPercent: "0.00",
    navisionNo: null,
    workflowStatus: null,
    total: "100.00",
    lines: [
      {
        lineNo: 1,
        itemNo: "I-0001",
        description: "Item",
        quantity: "1.000",
        unitPrice: "100.00",
        qtyToShip: "1.000",
      },
    ],
    stockShortfall: null,
    overdue: null,
    ...patch,
  };
}

export function entry(
  patch: Partial<OrderFacts> = {},
  shortages: OrderEntry["shortages"] = [],
): OrderEntry {
  return { facts: facts(patch), shortages };
}
