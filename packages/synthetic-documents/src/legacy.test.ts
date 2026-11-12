import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import { fieldsOf } from "./build-fields.js";
import { Canvas } from "./canvas.js";
import { placeFields, reviewCount } from "./confidence.js";
import { contextFor } from "./context.js";
import { buildFacts } from "./facts.js";
import { allSpecs } from "./fields.js";
import { LAYOUTS } from "./layouts/index.js";
import { DEMO_LABEL, type LegacyKind } from "./model.js";
import { writeTextPdf } from "./pdf.js";
import { definitionOf } from "./registry.js";
import { renderDocument, renderResolved } from "./render.js";
import { stamp } from "./stamp.js";
import { resolve } from "./subject.js";

const dataset = createSyntheticDataset();
const ctx = contextFor(dataset);

const CASES: [LegacyKind, string][] = [
  ["CUSTOMER_PO", "SO-0102"],
  ["PROFORMA_INVOICE", "SO-0075"],
  ["PACKING_LIST", "SO-0041"],
  ["SALES_INVOICE", "SO-0001"],
];

/** The original pipeline, written out: facts, fields, layout, stamp, writer. */
async function direct(kind: LegacyKind, orderNo: string): Promise<Uint8Array> {
  const facts = buildFacts(dataset, orderNo, kind);
  const canvas = new Canvas();
  LAYOUTS[facts.layout](canvas, facts, fieldsOf(facts));
  stamp(canvas.pages);
  const title = definitionOf(kind).title;
  return writeTextPdf(canvas.pages, {
    title: `${title} ${facts.number}`,
    subject: `${DEMO_LABEL}. ${title} for ${orderNo}.`,
    keywords: [DEMO_LABEL, kind, orderNo],
  });
}

describe("the original four kinds through the registry", () => {
  it.each(CASES)(
    "%s: the same facts, the same fields and the same bytes as the direct path",
    async (kind, orderNo) => {
      const definition = definitionOf(kind);
      const subject = resolve(ctx, { kind: "order", orderNo });
      const facts = definition.facts(ctx, subject, {
        stage: null,
        mistake: null,
        signed: false,
      });
      expect(facts).toEqual(buildFacts(dataset, orderNo, kind));
      expect(definition.fields(facts).specs).toEqual(
        allSpecs(fieldsOf(buildFacts(dataset, orderNo, kind))),
      );
      const rendered = await renderDocument(dataset, orderNo, kind);
      expect(
        Buffer.from(rendered.bytes).equals(
          Buffer.from(await direct(kind, orderNo)),
        ),
      ).toBe(true);
      expect(rendered.stage).toBeNull();
      expect(rendered.facts.ref).toBe(orderNo);
    },
  );

  it("number their documents, and not their fields, by the order", () => {
    for (const [kind, orderNo] of CASES) {
      const facts = buildFacts(dataset, orderNo, kind);
      expect(facts.orderNo).toBe(orderNo);
      expect(facts.vendorNo).toBeNull();
      expect(facts.issuer.kind).toBe(
        kind === "CUSTOMER_PO" ? "customer" : "spectra",
      );
    }
  });
});

describe("an order that is not in dataset.orders", () => {
  // A long order lives beside the dataset, under a number of its own.
  const original = dataset.orders.find((o) => o.header.no === "SO-0102");
  if (!original) throw new Error("no SO-0102");
  const renumbered = (order: typeof original) => ({
    ...order,
    header: { ...order.header, no: "LS-0001" },
  });
  const copy = renumbered(original);
  // Dates come from the order on the fixed reference date, as for any order.
  const pinnedOriginal = ctx.pinned.orders.find(
    (o) => o.header.no === "SO-0102",
  );
  if (!pinnedOriginal) throw new Error("no pinned SO-0102");
  const pinnedCopy = renumbered(pinnedOriginal);
  const customer = ctx.customer(copy.header.sellToCustomerNo);
  const subject = {
    ref: "LS-0001",
    order: copy,
    pinnedOrder: pinnedCopy,
    purchaseOrder: null,
    spr: null,
    payment: null,
    customer,
    vendor: null,
  };

  it("is really not there", () => {
    expect(dataset.orders.some((o) => o.header.no === "LS-0001")).toBe(false);
    expect(() => resolve(ctx, { kind: "order", orderNo: "LS-0001" })).toThrow(
      "No order LS-0001",
    );
  });

  it("renders a PI through the adapter with the same lines, fields and places", async () => {
    const own = await renderResolved(ctx, subject, "PROFORMA_INVOICE");
    const base = await renderDocument(dataset, "SO-0102", "PROFORMA_INVOICE");
    expect(own.facts.orderNo).toBe("LS-0001");
    expect(own.facts.ref).toBe("LS-0001");
    // An order with no PI of its own takes its PI number from its order
    // number, which is why a long order carries explicit document numbers.
    const shape = (fields: typeof own.fields) =>
      fields
        .filter((f) => f.id !== "piNumber")
        .map(({ id, value, text, page, box }) => ({
          id,
          value,
          text,
          page,
          box,
        }));
    expect(shape(own.fields)).toEqual(shape(base.fields));
    expect(own.facts.number).toBe("PI-0001");
    expect(Buffer.from(own.bytes).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("has no doubtful field, where the same PO of the dataset has two", async () => {
    const own = await renderResolved(ctx, subject, "CUSTOMER_PO");
    const base = await renderDocument(dataset, "SO-0102", "CUSTOMER_PO");
    expect(base.fields.filter((f) => f.uncertain)).toHaveLength(2);
    expect(own.fields.filter((f) => f.uncertain)).toHaveLength(0);
  });
});

describe("the confidence plan", () => {
  it("counts the fields a review task names, and none without one", () => {
    expect(reviewCount("SO-1", "Confirm the 3 uncertain fields")).toBe(3);
    expect(reviewCount("SO-1", "Check the fields")).toBe(0);
    expect(reviewCount("SO-1", undefined)).toBe(0);
    expect(() => reviewCount("SO-1", "Confirm the 9 uncertain fields")).toThrow(
      RangeError,
    );
  });

  it("hashes a stage into the confidence, so a draft and a final are read apart", () => {
    const fields = [
      {
        key: "poNumber",
        label: "PO number",
        group: "header" as const,
        lineIndex: null,
        value: "A",
        text: "A",
        page: 1,
        box: { x: 0, y: 0, w: 10, h: 10 },
      },
    ];
    const plan = {
      ref: "SO-1",
      kind: "CUSTOMER_PO" as const,
      uncertain: new Set<string>(),
      scanned: false,
    };
    const plain = placeFields(fields, { ...plan, stage: null });
    const staged = placeFields(fields, { ...plan, stage: "draft" });
    expect(plain[0]?.confidence).not.toBe(staged[0]?.confidence);
  });
});
