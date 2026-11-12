import { DOCUMENT_TYPES } from "@orderpilot/shared";
import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import { fieldsOf } from "./build-fields.js";
import { contextFor } from "./context.js";
import { buildFacts } from "./facts.js";
import { LAYOUTS } from "./layouts/index.js";
import { KINDS } from "./kinds/index.js";
import { applyMistake } from "./mistakes/index.js";
import {
  DOCUMENT_KINDS,
  LEGACY_KINDS,
  LEGACY_LAYOUTS,
  MISTAKE_KINDS,
} from "./model.js";
import { definitionOf } from "./registry.js";
import { renderDocument } from "./render.js";
import { resolve } from "./subject.js";

const dataset = createSyntheticDataset();
const ctx = contextFor(dataset);

describe("the registry of kinds", () => {
  it("holds one definition for each kind id, and no other", () => {
    expect(Object.keys(KINDS).sort()).toEqual([...DOCUMENT_KINDS].sort());
    for (const kind of DOCUMENT_KINDS) {
      expect(definitionOf(kind).kind).toBe(kind);
    }
  });

  it("gives every kind its own stem prefix, title and name", () => {
    const all = DOCUMENT_KINDS.map(definitionOf);
    for (const pick of [
      (d: (typeof all)[number]) => d.stemPrefix,
      (d: (typeof all)[number]) => d.title,
      (d: (typeof all)[number]) => d.name,
    ]) {
      expect(new Set(all.map(pick)).size).toBe(all.length);
    }
  });

  it("says which contract type each kind is, and it is a real one", () => {
    for (const kind of DOCUMENT_KINDS) {
      expect(DOCUMENT_TYPES).toContain(definitionOf(kind).type);
    }
    for (const kind of LEGACY_KINDS) expect(definitionOf(kind).type).toBe(kind);
  });

  it("keeps the original code on the original kinds and looks, whatever joins them", () => {
    for (const kind of LEGACY_KINDS) expect(DOCUMENT_KINDS).toContain(kind);
    expect(Object.keys(LAYOUTS).sort()).toEqual([...LEGACY_LAYOUTS].sort());
  });

  it("refuses a name that is not a kind", () => {
    expect(() => definitionOf("NOPE" as never)).toThrow(RangeError);
    expect(() => definitionOf("NOPE" as never)).toThrow("No NOPE documents");
    expect(() => buildFacts(dataset, "SO-0001", "AWB" as never)).toThrow(
      "No AWB documents",
    );
  });

  it("refuses a stage or a signature on a kind that has neither", async () => {
    await expect(
      renderDocument(dataset, "SO-0001", "SALES_INVOICE", { stage: "draft" }),
    ).rejects.toThrow(RangeError);
    await expect(
      renderDocument(dataset, "SO-0001", "SALES_INVOICE", { signed: true }),
    ).rejects.toThrow("cannot be signed");
  });

  it("refuses a render-time mistake that no mutation makes yet", async () => {
    expect(MISTAKE_KINDS).toContain("poReference");
    await expect(
      renderDocument(dataset, "SO-0001", "SALES_INVOICE", {
        mistake: "poReference",
      }),
    ).rejects.toThrow("No mutation for poReference on SALES_INVOICE");
    const facts = buildFacts(dataset, "SO-0001", "SALES_INVOICE");
    expect(applyMistake("SALES_INVOICE", facts, null)).toBe(facts);
  });
});

describe("the field book", () => {
  const order = "SO-0041";
  const facts = buildFacts(dataset, order, "PACKING_LIST");
  const book = definitionOf("PACKING_LIST").fields(facts);

  it("holds the specs of the original fields, in the original order", () => {
    expect(book.specs.length).toBeGreaterThan(10);
    expect(book.specs[0]?.key).toBe("packingListNumber");
    expect(book.lineSpecs()).toEqual(fieldsOf(facts).lines);
  });

  it("finds a field by key and line, and throws on one it lacks", () => {
    expect(book.get("lines.quantity", 0).lineIndex).toBe(0);
    expect(book.find("total")).toBeNull();
    expect(() => book.get("total")).toThrow("No field total");
  });
});

describe("a subject", () => {
  it("is found by the number a person would quote, with the old messages", () => {
    const subject = resolve(ctx, { kind: "order", orderNo: "SO-0102" });
    expect(subject.ref).toBe("SO-0102");
    expect(subject.order?.header.no).toBe("SO-0102");
    expect(subject.pinnedOrder?.header.no).toBe("SO-0102");
    expect(subject.customer?.no).toBe(subject.order?.header.sellToCustomerNo);
    expect(() => resolve(ctx, { kind: "order", orderNo: "SO-9999" })).toThrow(
      "No order SO-9999",
    );
  });

  it("holds a purchase order with its vendor, an SPR and a payment with their order", () => {
    const po = dataset.purchaseOrders[0];
    const spr = dataset.sprs[0];
    const payment = dataset.payments.find((p) => p.reference !== null);
    if (!po || !spr || !payment?.reference) throw new Error("no records");
    const byPo = resolve(ctx, { kind: "purchase-order", poNo: po.no });
    expect(byPo.vendor?.no).toBe(po.buyFromVendorNo);
    expect(byPo.order).toBeNull();
    const bySpr = resolve(ctx, { kind: "spr", orderNo: spr.orderNo });
    expect(bySpr.spr?.orderNo).toBe(spr.orderNo);
    expect(bySpr.vendor?.no).toBe(spr.vendorNo);
    const byPayment = resolve(ctx, {
      kind: "payment",
      reference: payment.reference,
    });
    expect(byPayment.payment?.orderNo).toBe(payment.orderNo);
    expect(byPayment.ref).toBe(payment.reference);
  });

  it("says so when a long order or a purchase order is not there", () => {
    expect(() => resolve(ctx, { kind: "long-order", no: "LS-9999" })).toThrow(
      "No long order LS-9999",
    );
    expect(resolve(ctx, { kind: "long-order", no: "LS-0001" }).order).toBe(
      ctx.longOrders[0],
    );
    expect(() =>
      resolve(ctx, { kind: "purchase-order", poNo: "PO-9999" }),
    ).toThrow("No purchase order PO-9999");
  });

  it("keeps one context for one dataset, with the vendor's one MAIN account", () => {
    expect(contextFor(dataset)).toBe(ctx);
    expect(contextFor(createSyntheticDataset())).not.toBe(ctx);
    const vendor = dataset.vendors[0];
    if (!vendor) throw new Error("no vendor");
    expect(ctx.bankOf(vendor.no).code).toBe("MAIN");
    expect(() => ctx.item("X-0")).toThrow("No item X-0");
  });
});
