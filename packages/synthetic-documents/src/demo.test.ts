import { CONFIDENCE_HIGH } from "@orderpilot/shared";
import { AS_OF, createSyntheticDataset } from "@orderpilot/synthetic-data";
import { beforeAll, describe, expect, it } from "vitest";
import { DEMO_FILES, pickDemoFiles, type GroundTruth } from "./demo.js";
import { layoutForCustomer } from "./facts-data.js";
import { PO_LAYOUTS } from "./model.js";
import { generated, type Generated } from "./testing/generated.js";

const dataset = createSyntheticDataset({ referenceDate: AS_OF });
let run: Generated;
beforeAll(async () => {
  run = await generated();
});

const truthOf = (stem: string): GroundTruth => {
  const truth = run.truth.get(stem);
  if (!truth) throw new Error(`No ground truth for ${stem}`);
  return truth;
};
const value = (truth: GroundTruth, id: string): string =>
  truth.fields.find((f) => f.id === id)?.value ?? "";

// `pickDemoFiles` fixes this order, and the test below keeps it equal to the list.
const stemAt = (index: number): string => {
  const file = DEMO_FILES[index];
  if (!file) throw new Error(`No demo file ${String(index)}`);
  return file.stem;
};
const PILOT = 0;
const SCAN = 4;
const MISMATCH_PO = 5;
const MISMATCH_PL = 6;
const MATCHING_PL = 7;
const PIS = [8, 9, 10].map(stemAt);
const INVOICE = 11;
const orderOf = (stem: string) => {
  const file = DEMO_FILES.find((f) => f.stem === stem);
  const order = dataset.orders.find((o) => o.header.no === file?.orderNo);
  if (!order) throw new Error(`No order for ${stem}`);
  return order;
};

describe("the demo files", () => {
  it("are what the data picks, so a change to the data fails here", () => {
    expect(pickDemoFiles(dataset)).toEqual(DEMO_FILES);
  });

  it("name each PO by the layout it is drawn in", () => {
    for (const file of DEMO_FILES.filter((f) => f.kind === "CUSTOMER_PO")) {
      const layout = truthOf(file.stem).layout;
      expect(file.stem.startsWith(`po-${layout}-so-`), file.stem).toBe(true);
    }
  });

  it("are twelve, each tied to a real order that has that document", () => {
    expect(DEMO_FILES).toHaveLength(12);
    expect(new Set(DEMO_FILES.map((f) => f.stem)).size).toBe(12);
    for (const file of DEMO_FILES) {
      const order = dataset.orders.find((o) => o.header.no === file.orderNo);
      expect(order, file.stem).toBeDefined();
      const document = order?.documents.find((d) => d.type === file.kind);
      expect(document, `${file.stem} has a ${file.kind}`).toBeDefined();
      expect(truthOf(file.stem).documentNumber).toBe(
        document?.number ?? order?.header.externalDocumentNo,
      );
    }
  });

  it("show POs in all four layouts, PIs, packing lists and one scan", () => {
    const pos = DEMO_FILES.filter((f) => f.kind === "CUSTOMER_PO");
    expect(new Set(pos.map((f) => truthOf(f.stem).layout))).toEqual(
      new Set(PO_LAYOUTS),
    );
    expect(
      DEMO_FILES.filter((f) => f.kind === "PROFORMA_INVOICE"),
    ).toHaveLength(3);
    expect(DEMO_FILES.filter((f) => f.kind === "PACKING_LIST")).toHaveLength(2);
    expect(DEMO_FILES.filter((f) => f.scanned)).toHaveLength(1);
    expect(truthOf(stemAt(SCAN)).readable).toBe("image");
  });

  it("give a customer the same layout every time, and every layout a customer", () => {
    const seen = new Map<string, string>();
    for (const order of dataset.orders) {
      const layout = layoutForCustomer(order.header.sellToCustomerNo);
      const before = seen.get(order.header.sellToCustomerNo);
      expect(before === undefined || before === layout).toBe(true);
      seen.set(order.header.sellToCustomerNo, layout);
    }
    expect(new Set(seen.values())).toEqual(new Set(PO_LAYOUTS));
    for (const file of DEMO_FILES.filter((f) => f.kind === "CUSTOMER_PO")) {
      expect(truthOf(file.stem).layout, file.stem).toBe(
        layoutForCustomer(orderOf(file.stem).header.sellToCustomerNo),
      );
    }
  });

  it("carry the totals of their order", () => {
    for (const stem of [stemAt(PILOT), ...PIS]) {
      expect(value(truthOf(stem), "total"), stem).toBe(orderOf(stem).total);
    }
  });

  it("show a PI's deposit and balance to the cent, and they add up", () => {
    const pi = truthOf(stemAt(8));
    const [total, due, balance] = ["total", "amountDue", "balanceDue"].map(
      (id) => Math.round(Number(value(pi, id)) * 100),
    );
    expect(due).toBeGreaterThan(0);
    expect((due ?? 0) + (balance ?? 0)).toBe(total);
    expect(value(pi, "amountDue")).toMatch(/^\d+\.\d{2}$/);
  });
});

describe("the dates and numbers the files print", () => {
  const ISSUE_ID: Record<string, string> = {
    CUSTOMER_PO: "poDate",
    PROFORMA_INVOICE: "piDate",
    PACKING_LIST: "packingListDate",
    SALES_INVOICE: "invoiceDate",
  };

  it("date each document the day the set says it was made", () => {
    for (const file of DEMO_FILES) {
      const document = dataset.orders
        .find((o) => o.header.no === file.orderNo)
        ?.documents.find((d) => d.type === file.kind);
      expect(
        value(truthOf(file.stem), ISSUE_ID[file.kind] ?? ""),
        file.stem,
      ).toBe(document?.receivedAt?.slice(0, 10));
    }
  });

  // A PI's number carries the day it was made, and that day moves with the
  // reference date. So after AS_OF the app shows another PI number than the
  // committed file. Every other number is the same on any day.
  it.each(["2026-12-15", "2027-03-01"])(
    "agree with the set built for %s, except a PI's number",
    (day) => {
      const later = createSyntheticDataset({ referenceDate: day });
      for (const file of DEMO_FILES) {
        const document = later.orders
          .find((o) => o.header.no === file.orderNo)
          ?.documents.find((d) => d.type === file.kind);
        const printed = truthOf(file.stem).documentNumber;
        if (file.kind === "PROFORMA_INVOICE") {
          expect(document?.number, file.stem).not.toBe(printed);
          expect(printed, file.stem).toMatch(/^PI-\d{8}-\d{4}$/);
        } else {
          expect(printed, file.stem).toBe(document?.number);
        }
      }
    },
  );
});

describe("the PI's bank details", () => {
  const bank = (stem: string) =>
    truthOf(stem).fields.filter((f) => f.group === "bank");

  it("are obviously fake and say so", () => {
    for (const stem of PIS) {
      const fields = bank(stem);
      expect(fields.map((f) => f.key).sort()).toEqual([
        "bankAccountNo",
        "bankBeneficiary",
        "bankName",
        "swiftCode",
      ]);
      expect(value(truthOf(stem), "bankName")).toContain("not a real bank");
      expect(value(truthOf(stem), "bankAccountNo")).toMatch(/^[0 ]+$/);
      expect(value(truthOf(stem), "swiftCode")).toMatch(/ZZ00$/);
    }
  });

  it("appear on a PI and nowhere else", () => {
    for (const file of DEMO_FILES.filter(
      (f) => f.kind !== "PROFORMA_INVOICE",
    )) {
      expect(bank(file.stem), file.stem).toEqual([]);
    }
  });
});

describe("the mismatch", () => {
  it("packs fewer pieces on line 1 than the PO orders, and no other line differs", () => {
    const po = truthOf(stemAt(MISMATCH_PO));
    const pl = truthOf(stemAt(MISMATCH_PL));
    const ordered = Number(value(po, "lines.quantity[0]"));
    const packed = Number(value(pl, "lines.quantity[0]"));
    expect(packed).toBeLessThan(ordered);
    expect(pl.mismatch).toEqual({
      lineIndex: 0,
      partNumber: value(po, "lines.partNumber[0]"),
      ordered: String(ordered),
      packed: String(packed),
    });
    expect(value(pl, "lines.quantity[1]")).toBe(value(po, "lines.quantity[1]"));
    expect(value(pl, "poNumber")).toBe(value(po, "poNumber"));
  });

  it("is the only packing list that disagrees with its order", () => {
    const order = orderOf(stemAt(MATCHING_PL));
    const pl = truthOf(stemAt(MATCHING_PL));
    expect(pl.mismatch).toBeNull();
    order.lines.forEach((line, i) => {
      expect(value(pl, `lines.quantity[${String(i)}]`)).toBe(line.quantity);
    });
  });
});

describe("the three-uncertain-fields rule", () => {
  const taskCount = (orderNo: string): number | null => {
    const task = dataset.tasks.find(
      (t) => t.orderNo === orderNo && t.kind === "REVIEW_FIELDS",
    );
    const n = /^Confirm the (\d+) uncertain fields$/.exec(task?.title ?? "");
    return n?.[1] ? Number(n[1]) : null;
  };

  it("gives an order whose task names N fields exactly N below the threshold", () => {
    const named = DEMO_FILES.filter(
      (f) => f.kind === "CUSTOMER_PO" && taskCount(f.orderNo) !== null,
    );
    expect(named.map((f) => taskCount(f.orderNo)).sort()).toEqual([2, 3, 4]);
    for (const file of named) {
      const truth = truthOf(file.stem);
      const below = truth.fields.filter((f) => f.confidence < CONFIDENCE_HIGH);
      expect(below, file.stem).toHaveLength(taskCount(file.orderNo) ?? -1);
      expect(truth.uncertainFieldCount).toBe(below.length);
    }
  });

  it("gives the PO to try in the sales pilot exactly two fields to confirm", () => {
    expect(truthOf(stemAt(PILOT)).uncertainFieldCount).toBe(2);
  });

  it("uses the shared threshold and flags exactly what falls under it", () => {
    for (const truth of run.truth.values()) {
      expect(truth.confidenceThreshold).toBe(CONFIDENCE_HIGH);
      for (const field of truth.fields) {
        expect(field.confidence).toBeGreaterThan(0);
        expect(field.confidence).toBeLessThanOrEqual(1);
        expect(field.uncertain).toBe(field.confidence < CONFIDENCE_HIGH);
      }
    }
  });

  it("leaves a PO that is not read by Mock AI, and every other document, with nothing to confirm, and a scan with all of it", () => {
    for (const stem of [
      stemAt(8),
      stemAt(MATCHING_PL),
      stemAt(INVOICE),
      stemAt(MISMATCH_PO),
      stemAt(1),
    ]) {
      expect(truthOf(stem).uncertainFieldCount, stem).toBe(0);
    }
    const scan = truthOf(stemAt(SCAN));
    expect(scan.uncertainFieldCount).toBe(scan.fields.length);
  });
});
