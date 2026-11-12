import {
  AS_OF,
  addDays,
  syntheticDataset,
  type SampleOrder,
} from "@orderpilot/synthetic-data";
import type { LegacyKind } from "./model.js";

export function find<T>(
  list: readonly T[],
  test: (item: T) => boolean,
  what: string,
): T {
  const found = list.find(test);
  if (!found) throw new Error(`No ${what}`);
  return found;
}

/**
 * The dates and numbers a document prints. Dates in the synthetic set move
 * with today, but a committed file cannot, so these come from the set as it
 * stands on its fixed reference date. Everything else comes from the set the
 * caller passes, and does not move.
 */
export function pinned(orderNo: string): SampleOrder {
  return find(
    syntheticDataset({ referenceDate: AS_OF }).orders,
    (o) => o.header.no === orderNo,
    `order ${orderNo}`,
  );
}

export function numberOf(order: SampleOrder, kind: LegacyKind): string {
  const suffix = order.header.no.slice(3);
  const fallback: Record<LegacyKind, string> = {
    CUSTOMER_PO: order.header.externalDocumentNo,
    PROFORMA_INVOICE: `PI-${suffix}`,
    PACKING_LIST: `PL-${suffix}`,
    SALES_INVOICE: `SI-${suffix}`,
  };
  return order.documents.find((d) => d.type === kind)?.number ?? fallback[kind];
}

/**
 * The day the set says this document was made, when the set has one. The
 * number of a PI carries that day, so the date printed beside it must be the
 * same day. A guess from the order date is only for an order that has none.
 */
function madeOn(order: SampleOrder, kind: LegacyKind): string | null {
  return (
    order.documents.find((d) => d.type === kind)?.receivedAt?.slice(0, 10) ??
    null
  );
}

export function datesOf(
  order: SampleOrder,
  kind: LegacyKind,
  creditDays: number,
): { issueDate: string; otherDate: string | null } {
  const ordered = order.header.orderDate;
  const done = order.milestones;
  switch (kind) {
    case "CUSTOMER_PO":
      return {
        issueDate: ordered,
        otherDate: order.header.shipmentDate ?? addDays(ordered, 21),
      };
    case "PROFORMA_INVOICE": {
      const issueDate = madeOn(order, kind) ?? done.pi ?? addDays(ordered, 3);
      return { issueDate, otherDate: addDays(issueDate, 14) };
    }
    case "PACKING_LIST":
      return {
        issueDate: madeOn(order, kind) ?? done.packed ?? addDays(ordered, 14),
        otherDate: null,
      };
    case "SALES_INVOICE": {
      const issueDate =
        madeOn(order, kind) ?? done.invoiced ?? addDays(ordered, 18);
      return { issueDate, otherDate: addDays(issueDate, creditDays) };
    }
  }
}
