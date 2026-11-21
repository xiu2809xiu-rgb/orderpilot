import type {
  ItemRow,
  MaskedField,
  SalesOrderDetail,
  SalesOrderRow,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  MAX_ORDER_LINES,
  MAX_ORDERS,
  MAX_RESULT_CHARACTERS,
  MAX_STOCK_ITEMS,
  NO_SUCH_ORDER,
  notFoundOrder,
  orderOutputOf,
  ordersOutputOf,
  stockOutputOf,
} from "./spark-tool-results.js";

const shown = (value: string): MaskedField => ({
  field: "item.unitPrice",
  classification: "confidential",
  masked: false,
  value,
  reason: null,
});
const hidden: MaskedField = {
  field: "item.unitPrice",
  classification: "confidential",
  masked: true,
  value: null,
  reason: "price",
};

function item(
  no: string,
  price: MaskedField,
  description = "HP Monitor",
): ItemRow {
  return {
    no,
    description,
    partNumber: "PN-1",
    brand: "HP",
    category: "PERIPHERALS",
    baseUnitOfMeasure: "PCS",
    inventory: "880",
    qtyOnSalesOrder: "6",
    qtyOnPurchOrder: "146",
    availableStock: "1020",
    availability: "ok",
    unitPrice: price,
    // What must never reach the model.
    vendorNo: "V-SECRET-0001",
    vendorName: "Secret Vendor Pte Ltd",
  };
}

function orderRow(orderNo: string, amount: MaskedField): SalesOrderRow {
  return {
    orderNo,
    source: "sample",
    captureState: null,
    customerNo: "C-0001",
    customerName: "Acme Trading",
    externalDocumentNo: "CUSTOMER-PO-SECRET-REF",
    orderDate: "2026-11-02",
    shipmentDate: null,
    workflowStatus: "Awaiting payment",
    amount,
    currencyCode: "USD",
    shortage: null,
    shortageCount: 0,
  };
}

function orderDetail(lines: number, description = "Monitor"): SalesOrderDetail {
  return {
    ...orderRow("SO-0001", shown("5000.00")),
    prepaymentPercent: "30.00",
    navisionNo: "NAV-SECRET-REF",
    version: 4,
    lines: Array.from({ length: lines }, (_, index) => ({
      lineNo: index + 1,
      itemNo: "I-0025",
      description,
      quantity: "10",
      qtyToShip: "10",
      unitPrice: shown("500.00"),
      lineAmount: shown("5000.00"),
      shortBy: null,
    })),
  };
}

const keysOf = (value: object): string[] => Object.keys(value).sort();

describe("what check_stock hands the model", () => {
  it("names the fields it keeps and nothing a service added: no vendor, no cost", () => {
    const { result } = stockOutputOf({
      items: [item("I-0025", shown("120.00"))],
      total: 1,
    });
    if (!result.found) throw new Error("expected a hit");
    expect(keysOf(result)).toEqual(["found", "items", "matched"]);
    expect(keysOf(result.items[0] ?? {})).toEqual([
      "availability",
      "available",
      "brand",
      "description",
      "itemNo",
      "onHand",
      "onPurchaseOrders",
      "onSalesOrders",
      "partNumber",
      "unit",
      "unitPrice",
    ]);
    const text = JSON.stringify(result);
    expect(text).not.toContain("V-SECRET");
    expect(text).not.toContain("Secret Vendor");
  });

  it("hands over a price as a value only when the service did, and as hidden with its reason when it did not", () => {
    const seen = stockOutputOf({
      items: [item("I-0025", shown("120.00"))],
      total: 1,
    }).result;
    const masked = stockOutputOf({
      items: [item("I-0025", hidden)],
      total: 1,
    }).result;
    expect(JSON.stringify(seen)).toContain('"value":"120.00"');
    expect(JSON.stringify(masked)).not.toContain("120");
    expect(JSON.stringify(masked)).toContain('"hidden":true');
    expect(JSON.stringify(masked)).toContain('"reason":"price"');
  });

  it("treats a field that is not masked but has no value as hidden, never as zero", () => {
    const odd: MaskedField = { ...shown("1.00"), value: null };
    expect(
      JSON.stringify(
        stockOutputOf({ items: [item("I-0025", odd)], total: 1 }).result,
      ),
    ).toContain('"hidden":true');
  });

  it("gives one source for each item it shows, and no more than it shows", () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      item(`I-${String(i).padStart(4, "0")}`, hidden),
    );
    const { result, sources } = stockOutputOf({ items: rows, total: 9 });
    if (!result.found) throw new Error("expected hits");
    expect(result.items).toHaveLength(MAX_STOCK_ITEMS);
    expect(result.matched).toBe(9);
    expect(sources).toHaveLength(MAX_STOCK_ITEMS);
    expect(sources[0]).toEqual({
      kind: "item",
      id: "I-0000",
      label: "Item I-0000, HP Monitor",
    });
  });

  it("answers a search that finds nothing as a plain result with no source", () => {
    expect(stockOutputOf({ items: [], total: 0 })).toEqual({
      result: { found: false, message: "No item matches that search." },
      sources: [],
    });
  });
});

describe("what find_orders hands the model", () => {
  it("names the fields it keeps: no customer reference, no Navision number, no version", () => {
    const { result } = ordersOutputOf({
      items: [orderRow("SO-0001", shown("5000.00"))],
      total: 1,
    });
    if (!result.found) throw new Error("expected a hit");
    expect(keysOf(result.orders[0] ?? {})).toEqual([
      "amount",
      "captureState",
      "customerName",
      "customerNo",
      "orderDate",
      "orderNo",
      "shipmentDate",
      "shortage",
      "shortageCount",
      "status",
    ]);
    expect(JSON.stringify(result)).not.toContain("CUSTOMER-PO-SECRET-REF");
  });

  it("hides an amount the service masked, with the reason", () => {
    const text = JSON.stringify(
      ordersOutputOf({ items: [orderRow("SO-0001", hidden)], total: 1 }).result,
    );
    expect(text).toContain('"hidden":true');
    expect(text).not.toContain("5000");
  });

  it("shows at most ten orders, with one source each, and says how many matched", () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      orderRow(`SO-${String(i + 1).padStart(4, "0")}`, hidden),
    );
    const { result, sources } = ordersOutputOf({ items: rows, total: 25 });
    if (!result.found) throw new Error("expected hits");
    expect(result.orders).toHaveLength(MAX_ORDERS);
    expect(result.matched).toBe(25);
    expect(sources.map((s) => s.id)).toEqual(
      result.orders.map((o) => o.orderNo),
    );
  });

  it("answers no match as a plain result", () => {
    expect(ordersOutputOf({ items: [], total: 0 }).result).toEqual({
      found: false,
      message: "No order matches that search.",
    });
  });
});

describe("what get_order hands the model", () => {
  it("names the fields of the order and of each line", () => {
    const { result, sources } = orderOutputOf(orderDetail(2));
    if (!result.found) throw new Error("expected a hit");
    expect(keysOf(result.order)).toEqual([
      "amount",
      "captureState",
      "customerName",
      "customerNo",
      "lineCount",
      "lines",
      "orderDate",
      "orderNo",
      "shipmentDate",
      "shortage",
      "shortageCount",
      "status",
    ]);
    expect(keysOf(result.order.lines[0] ?? {})).toEqual([
      "description",
      "itemNo",
      "lineAmount",
      "lineNo",
      "qtyToShip",
      "quantity",
      "shortBy",
      "unitPrice",
    ]);
    expect(JSON.stringify(result)).not.toContain("NAV-SECRET-REF");
    expect(JSON.stringify(result)).not.toContain("CUSTOMER-PO-SECRET-REF");
    expect(sources).toEqual([
      { kind: "order", id: "SO-0001", label: "Order SO-0001" },
    ]);
  });

  it("keeps a masked unit price and line amount hidden on every line", () => {
    const masked: SalesOrderDetail = {
      ...orderDetail(3),
      amount: hidden,
      lines: orderDetail(3).lines.map((line) => ({
        ...line,
        unitPrice: hidden,
        lineAmount: hidden,
      })),
    };
    const text = JSON.stringify(orderOutputOf(masked).result);
    expect(text).not.toContain("500");
    expect(text).not.toContain("5000");
    expect(text.match(/"hidden":true/g)).toHaveLength(7);
  });

  it("says plainly that an order is not there, with no source", () => {
    expect(notFoundOrder()).toEqual({
      result: { found: false, message: NO_SUCH_ORDER },
      sources: [],
    });
  });
});

describe("how large a result can be", () => {
  const huge = "x".repeat(5000);

  it("stays well under the tool loop's cut-off with the worst input of each tool", () => {
    const stock = stockOutputOf({
      items: Array.from({ length: 50 }, (_, i) =>
        item(`I-${String(i).padStart(4, "0")}`, shown("1.00"), huge),
      ),
      total: 50,
    });
    const orders = ordersOutputOf({
      items: Array.from({ length: 200 }, (_, i) => ({
        ...orderRow(`SO-${String(i)}`, shown("1.00")),
        customerName: huge,
      })),
      total: 200,
    });
    const order = orderOutputOf(orderDetail(500, huge));
    for (const result of [stock.result, orders.result, order.result]) {
      expect(JSON.stringify(result).length).toBeLessThan(MAX_RESULT_CHARACTERS);
    }
    // 20,000 is where the loop cuts and breaks the JSON.
    expect(MAX_RESULT_CHARACTERS).toBeLessThan(20_000);
    if (!order.result.found) throw new Error("expected a hit");
    expect(order.result.order.lines).toHaveLength(MAX_ORDER_LINES);
    expect(order.result.order.lineCount).toBe(500);
  });

  it("cuts a long description and marks the cut", () => {
    const { result } = stockOutputOf({
      items: [item("I-0001", hidden, huge)],
      total: 1,
    });
    if (!result.found) throw new Error("expected a hit");
    const description = result.items[0]?.description ?? "";
    expect(description.length).toBeLessThanOrEqual(120);
    expect(description.endsWith("…")).toBe(true);
  });
});
