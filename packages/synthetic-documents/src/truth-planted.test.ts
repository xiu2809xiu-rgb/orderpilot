import {
  AS_OF,
  createSyntheticDataset,
  plantedCases,
} from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import { DEMO_FILES } from "./demo.js";
import { asEntry } from "./plan/entry.js";
import { twelvePlan } from "./plan/twelve.js";
import { renderDocument } from "./render.js";
import { groundTruth } from "./truth.js";

const dataset = createSyntheticDataset({ referenceDate: AS_OF });
const plan = twelvePlan(dataset, DEMO_FILES);

describe("the planted PI whose price differs from its PO", () => {
  const { order } = plantedCases(dataset).piPriceMismatch;
  const orderNo = order.header.no;

  it("records the price as the primary field and what follows from it", async () => {
    const pi = await renderDocument(dataset, orderNo, "PROFORMA_INVOICE");
    const po = await renderDocument(dataset, orderNo, "CUSTOMER_PO");
    const record = pi.facts.planted;
    if (!record) throw new Error("not planted");
    expect(record.kind).toBe("unitPrice");
    expect(record.primaryFieldId).toBe("lines.unitPrice[0]");
    expect(record.values.map((v) => v.fieldId).slice(0, 3)).toEqual([
      "lines.unitPrice[0]",
      "lines.amount[0]",
      "total",
    ]);
    for (const value of record.values) {
      expect(value.printed, value.fieldId).not.toBe(value.expected);
      const field = pi.fields.find((f) => f.id === value.fieldId);
      expect(field?.value, value.fieldId).toBe(value.printed);
    }
    const poPrice = po.fields.find((f) => f.id === "lines.unitPrice[0]");
    expect(record.values[0]?.expected).toBe(poPrice?.value);
    expect(po.facts.planted).toBeNull();
  });

  it("is on no other kind and no other order", async () => {
    const other = dataset.orders.find(
      (o) =>
        o.scenario.kind === "none" &&
        o.documents.some((d) => d.type === "PROFORMA_INVOICE"),
    );
    if (!other) throw new Error("no other order");
    const pi = await renderDocument(
      dataset,
      other.header.no,
      "PROFORMA_INVOICE",
    );
    expect(pi.facts.planted).toBeNull();
    const invoice = await renderDocument(dataset, orderNo, "SALES_INVOICE");
    expect(invoice.facts.planted).toBeNull();
  });
});

describe("a plan that disagrees with the document", () => {
  const entry = plan.find((e) => e.stem === "pl-so-0041-mismatch");
  const clean = plan.find((e) => e.stem === "pl-so-0026");
  if (!entry || !clean) throw new Error("no entries");

  it("is refused when it names a mistake the document does not print", async () => {
    const rendered = await renderDocument(
      dataset,
      clean.subject.kind === "order" ? clean.subject.orderNo : "",
      clean.kind,
    );
    expect(() =>
      groundTruth({ ...clean, planted: "quantity" }, rendered, plan),
    ).toThrow("is planned as quantity but prints null");
  });

  it("is refused when the document prints a mistake it does not name", async () => {
    const rendered = await renderDocument(dataset, "SO-0041", "PACKING_LIST");
    expect(() =>
      groundTruth({ ...entry, planted: null }, rendered, plan),
    ).toThrow("is planned as null but prints quantity");
  });

  it("is refused when the primary field has no source, or a related stem is not in the plan", async () => {
    const rendered = await renderDocument(dataset, "SO-0041", "PACKING_LIST");
    expect(() =>
      groundTruth({ ...entry, expectedFrom: {} }, rendered, plan),
    ).toThrow("names no source for lines.quantity[0]");
    expect(() =>
      groundTruth({ ...entry, twin: "pl-so-9999" }, rendered, plan),
    ).toThrow("pl-so-9999, which is not in the plan");
  });

  it("lifts a demo file as an order's document with no stage", () => {
    const [file] = DEMO_FILES;
    if (!file) throw new Error("no file");
    expect(asEntry(file)).toMatchObject({
      stage: null,
      signed: false,
      mistake: null,
      planted: null,
      bundle: null,
      committed: true,
      subject: { kind: "order", orderNo: file.orderNo },
    });
  });
});
