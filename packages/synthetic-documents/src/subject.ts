import type {
  Customer,
  PurchaseOrder,
  SampleOrder,
  SamplePayment,
  SampleSpr,
  Vendor,
} from "@orderpilot/synthetic-data";
import type { RenderContext } from "./context.js";
import { find } from "./pinned.js";

/** What a document hangs on, by the number a person would quote. */
export type SubjectRef =
  | { kind: "order"; orderNo: string }
  | { kind: "long-order"; no: string }
  | { kind: "purchase-order"; poNo: string }
  | { kind: "spr"; orderNo: string }
  | { kind: "payment"; reference: string };

/** The records one document is made from. */
export interface Subject {
  /** "SO-0102", "LS-0001", "PO-0021", an SPR number or "TT-0058-PRE": the confidence hash reads it. */
  ref: string;
  /** From the dataset given: lines, prices and terms, which do not move with the date. */
  order: SampleOrder | null;
  /** The same order on the fixed reference date: dates and dated numbers. */
  pinnedOrder: SampleOrder | null;
  purchaseOrder: PurchaseOrder | null;
  spr: SampleSpr | null;
  payment: SamplePayment | null;
  customer: Customer | null;
  vendor: Vendor | null;
}

const NONE: Subject = {
  ref: "",
  order: null,
  pinnedOrder: null,
  purchaseOrder: null,
  spr: null,
  payment: null,
  customer: null,
  vendor: null,
};

function orderOf(ctx: RenderContext, orderNo: string): SampleOrder {
  return find(
    ctx.dataset.orders,
    (o) => o.header.no === orderNo,
    `order ${orderNo}`,
  );
}

function pinnedOrderOf(ctx: RenderContext, orderNo: string): SampleOrder {
  return find(
    ctx.pinned.orders,
    (o) => o.header.no === orderNo,
    `order ${orderNo}`,
  );
}

/** Looks a subject up. The messages are the ones the renderer always gave: "No order SO-9999". */
export function resolve(ctx: RenderContext, ref: SubjectRef): Subject {
  switch (ref.kind) {
    case "order": {
      const order = orderOf(ctx, ref.orderNo);
      return {
        ...NONE,
        ref: ref.orderNo,
        order,
        pinnedOrder: pinnedOrderOf(ctx, ref.orderNo),
        customer: ctx.customer(order.header.sellToCustomerNo),
      };
    }
    case "long-order": {
      const order = find(
        ctx.longOrders,
        (o) => o.header.no === ref.no,
        `long order ${ref.no}`,
      );
      return {
        ...NONE,
        ref: ref.no,
        order,
        pinnedOrder: order,
        customer: ctx.customer(order.header.sellToCustomerNo),
      };
    }
    case "purchase-order": {
      const purchaseOrder = find(
        [...ctx.pinned.purchaseOrders, ...ctx.longPurchaseOrders],
        (p) => p.no === ref.poNo,
        `purchase order ${ref.poNo}`,
      );
      return {
        ...NONE,
        ref: ref.poNo,
        purchaseOrder,
        vendor: ctx.vendor(purchaseOrder.buyFromVendorNo),
      };
    }
    case "spr": {
      const order = orderOf(ctx, ref.orderNo);
      const spr = find(
        ctx.pinned.sprs,
        (s) => s.orderNo === ref.orderNo,
        `SPR for ${ref.orderNo}`,
      );
      return {
        ...NONE,
        ref: spr.recordNo,
        order,
        pinnedOrder: pinnedOrderOf(ctx, ref.orderNo),
        spr,
        customer: ctx.customer(order.header.sellToCustomerNo),
        vendor: ctx.vendor(spr.vendorNo),
      };
    }
    case "payment": {
      const payment = find(
        ctx.pinned.payments,
        (p) => p.reference === ref.reference,
        `payment ${ref.reference}`,
      );
      const order = orderOf(ctx, payment.orderNo);
      return {
        ...NONE,
        ref: ref.reference,
        order,
        pinnedOrder: pinnedOrderOf(ctx, payment.orderNo),
        payment,
        customer: ctx.customer(order.header.sellToCustomerNo),
      };
    }
  }
}
