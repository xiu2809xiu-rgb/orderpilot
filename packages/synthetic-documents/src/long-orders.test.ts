import {
  agreedPrice,
  createSyntheticDataset,
  plantedCases,
  syntheticDataset,
} from "@orderpilot/synthetic-data";
import { beforeAll, describe, expect, it } from "vitest";
import { contextFor } from "./context.js";
import { layoutForCustomer } from "./facts-data.js";
import { LONG_ORDERS, longOrders, longPurchaseOrders } from "./long-orders.js";
import type { DocumentKind } from "./model.js";
import { renderResolved, type RenderedDocument } from "./render.js";
import { STAMP_BASELINE } from "./stamp.js";
import {
  PRINTABLE,
  drawn,
  longSubject,
  lowest,
  pageOfLines,
  withLines,
} from "./testing/long.js";
import { textOrigins } from "./testing/pdf-reader.js";

const dataset = createSyntheticDataset();
const ctx = contextFor(dataset);

describe("the long orders", () => {
  it("live beside the dataset: no SO number, and not in dataset.orders", () => {
    const orders = longOrders(dataset);
    expect(orders.map((o) => o.header.no)).toEqual(
      LONG_ORDERS.map((o) => o.no),
    );
    for (const order of orders) {
      expect(order.header.no.startsWith("SO-")).toBe(false);
      expect(dataset.orders.some((o) => o.header.no === order.header.no)).toBe(
        false,
      );
      expect(
        dataset.orders.some(
          (o) =>
            o.header.externalDocumentNo === order.header.externalDocumentNo,
        ),
      ).toBe(false);
    }
    expect(dataset.orders).toHaveLength(120);
  });

  it("have their own customers, looks and terms, and the customer's country in the PO number", () => {
    longOrders(dataset).forEach((order, i) => {
      const spec = LONG_ORDERS[i];
      const customer = ctx.customer(order.header.sellToCustomerNo);
      expect(layoutForCustomer(customer.no)).toBe(spec?.layout);
      expect(customer.paymentTermsCode).toBe(spec?.terms);
      expect(order.lines).toHaveLength(spec?.lines ?? -1);
      expect(order.header.externalDocumentNo).toBe(
        `PO-${customer.countryRegionCode}-${String(4001 + i)}`,
      );
    });
  });

  it("price every line at what the customer agreed, and never repeat an item", () => {
    for (const order of longOrders(dataset)) {
      const customer = ctx.customer(order.header.sellToCustomerNo);
      const items = order.lines.map((l) => l.no);
      expect(new Set(items).size).toBe(items.length);
      expect(items).not.toContain(plantedCases(dataset).shortStock.item.no);
      for (const line of order.lines) {
        expect(line.unitPrice).toBe(
          agreedPrice(dataset.seed, customer, ctx.item(line.no)),
        );
      }
    }
  });

  it("carry explicit document numbers, so none falls back to another order's", () => {
    for (const order of longOrders(dataset)) {
      const digits = order.header.no.slice(3);
      const number = (type: string) =>
        order.documents.find((d) => d.type === type)?.number;
      expect(number("PACKING_LIST")).toBe(`PL-LS${digits}`);
      expect(number("SALES_INVOICE")).toBe(`SI-LS${digits}`);
      expect(number("PROFORMA_INVOICE")).toMatch(/^PI-\d{8}-9\d{3}$/);
    }
  });

  it("are the same on any day", () => {
    const later = syntheticDataset({ referenceDate: "2027-03-01" });
    expect(longOrders(later)).toEqual(longOrders(dataset));
    expect(longPurchaseOrders(later)).toEqual(longPurchaseOrders(dataset));
  });

  it("include one long purchase order, with a line for every item of the vendor with most", () => {
    const [po, ...rest] = longPurchaseOrders(dataset);
    expect(rest).toEqual([]);
    expect(po?.no).toBe("LP-0001");
    const items = dataset.items.filter(
      (i) => i.vendorNo === po?.buyFromVendorNo,
    );
    expect(po?.lines.map((l) => l.no)).toEqual(items.map((i) => i.no));
    for (const other of dataset.vendors) {
      expect(
        dataset.items.filter((i) => i.vendorNo === other.no).length,
      ).toBeLessThanOrEqual(items.length);
    }
    expect(dataset.purchaseOrders.some((p) => p.no === "LP-0001")).toBe(false);
  });
});

const KINDS: DocumentKind[] = [
  "CUSTOMER_PO",
  "PROFORMA_INVOICE",
  "PACKING_LIST",
  "SALES_INVOICE",
];

describe("every long order really flows", () => {
  const rendered = new Map<string, RenderedDocument>();
  beforeAll(async () => {
    for (const spec of LONG_ORDERS) {
      for (const kind of KINDS) {
        rendered.set(
          `${spec.no}/${kind}`,
          await renderResolved(ctx, longSubject(ctx, spec.no), kind),
        );
      }
    }
  });

  it("runs each PO onto a second page in its own layout", () => {
    for (const spec of LONG_ORDERS) {
      const po = rendered.get(`${spec.no}/CUSTOMER_PO`);
      expect(po?.layout).toBe(spec.layout);
      const pages = pageOfLines(po?.fields ?? []);
      expect(Math.max(...pages), spec.no).toBeGreaterThanOrEqual(2);
    }
  });

  it("takes the longest order onto three pages in the house look", () => {
    for (const kind of KINDS.slice(1)) {
      expect(
        rendered.get(`LS-0004/${kind}`)?.pageCount,
        kind,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("prints every line once, in order, on the page its text is drawn on", async () => {
    for (const [name, doc] of rendered) {
      const lines = doc.fields.filter((f) => f.key === "lines.partNumber");
      expect(
        lines.map((f) => f.lineIndex),
        name,
      ).toEqual(Array.from({ length: lines.length }, (_, i) => i));
      const pages = lines.map((f) => f.page);
      expect(pages, name).toEqual([...pages].sort((a, b) => a - b));
      const origins = await textOrigins(doc.bytes);
      for (const field of doc.fields.filter((f) => f.lineIndex !== null)) {
        const [x, y, w, h] = field.box;
        const box = {
          x: x * 595.28,
          y: y * 841.89,
          w: w * 595.28,
          h: h * 841.89,
        };
        const inside = origins.filter(
          (o) =>
            o.page === field.page &&
            o.x >= box.x - 0.01 &&
            o.x <= box.x + box.w &&
            o.y >= box.y - 0.01 &&
            o.y <= box.y + box.h,
        );
        expect(inside.length, `${name} ${field.id}`).toBeGreaterThan(0);
      }
    }
  });

  it("carries the label and its own page number on every page", async () => {
    for (const [name, doc] of rendered) {
      const origins = await textOrigins(doc.bytes);
      const foot = origins.filter((o) => Math.abs(o.y - STAMP_BASELINE) < 0.01);
      const labels = foot.filter((o) => o.x === 36).map((o) => o.page);
      const numbers = foot.filter((o) => o.x !== 36).map((o) => o.page);
      const all = Array.from({ length: doc.pageCount }, (_, i) => i + 1);
      expect(labels, name).toEqual(all);
      expect(numbers, name).toEqual(all);
    }
  });

  it("records every field once, so what a continuation page repeats is not one", () => {
    for (const [name, doc] of rendered) {
      const keys = doc.fields.map((f) => f.id);
      expect(new Set(keys).size, name).toBe(keys.length);
    }
  });
});

describe("nothing is drawn below the printable area, at any length", () => {
  const cases: [string, string, DocumentKind, number][] = [
    ["house PI", "LS-0004", "PROFORMA_INVOICE", 90],
    ["house packing list", "LS-0004", "PACKING_LIST", 90],
    ["house invoice", "LS-0004", "SALES_INVOICE", 90],
    ["table PO", "LS-0003", "CUSTOMER_PO", 70],
    ["boxed PO", "LS-0004", "CUSTOMER_PO", 90],
  ];

  it.each(cases)("%s", (_name, no, kind, most) => {
    const base = longSubject(ctx, no);
    let closingAlone = 0;
    for (let n = 1; n <= most; n++) {
      const { canvas, fields, facts } = drawn(ctx, withLines(base, n), kind);
      expect(lowest(canvas.pages), `${String(n)} lines`).toBeLessThanOrEqual(
        PRINTABLE,
      );
      for (const f of fields) {
        expect(f.box.y + f.box.h).toBeLessThanOrEqual(PRINTABLE);
      }
      expect(fields.filter((f) => f.key === "lines.partNumber")).toHaveLength(
        n,
      );
      // The boxed form ends with a page of terms, which is not the table's.
      const tablePages =
        facts.layout === "boxed"
          ? canvas.pages.length - 1
          : canvas.pages.length;
      if (tablePages > Math.max(...pageOfLines(fields))) closingAlone++;
    }
    expect(closingAlone, "lengths whose block moved alone").toBeGreaterThan(0);
  });
});

describe("the layouts that do not flow", () => {
  it.each([
    ["letter", "C-0012"],
    ["branded", "C-0019"],
  ])(
    "a %s PO refuses an order that does not fit",
    async (layout, customerNo) => {
      expect(layoutForCustomer(customerNo)).toBe(layout);
      const base = longSubject(ctx, "LS-0003");
      if (!base.order) throw new Error("no order");
      const order = {
        ...base.order,
        header: { ...base.order.header, sellToCustomerNo: customerNo },
      };
      const subject = {
        ...base,
        order,
        pinnedOrder: order,
        customer: ctx.customer(customerNo),
      };
      await expect(renderResolved(ctx, subject, "CUSTOMER_PO")).rejects.toThrow(
        "does not fit",
      );
    },
  );
});
