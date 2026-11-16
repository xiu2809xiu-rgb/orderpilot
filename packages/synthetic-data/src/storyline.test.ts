import { afterEach, describe, expect, it } from "vitest";
import { addDecimal, multiplyDecimal, sumDecimal } from "@orderpilot/shared";
import {
  AS_OF,
  STORYLINE,
  createSyntheticDataset,
  setDemoStoryline,
  syntheticDataset,
  withDemoStoryline,
} from "./index.js";
import { availableStock } from "./stock.js";
import type { SampleOrder, SyntheticDataset } from "./types.js";

const base = createSyntheticDataset();
const told = withDemoStoryline(base);

function order(dataset: SyntheticDataset, no: string): SampleOrder {
  const found = dataset.orders.find((o) => o.header.no === no);
  if (!found) throw new Error(`No ${no}`);
  return found;
}

describe("the demo storyline", () => {
  afterEach(() => {
    setDemoStoryline(false);
  });

  it("adds one customer and leaves every other count as it was", () => {
    expect(told.customers).toHaveLength(base.customers.length + 1);
    for (const key of [
      "vendors",
      "items",
      "orders",
      "payments",
      "sprs",
      "purchaseOrders",
      "tasks",
      "reminders",
      "exceptions",
    ] as const)
      expect(told[key]).toHaveLength(base[key].length);
  });

  it("makes the new customer a copy of the old one, under its own number and name", () => {
    const present = base.customers.find((c) => c.no === "C-0006");
    const added = told.customers.find((c) => c.no === "C-1042");
    expect(added).toEqual({ ...present, ...STORYLINE.customer });
    expect(added?.name).toBe("Meridian Vale Technologies Pvt Ltd");
  });

  it("changes only the two storyline orders", () => {
    for (const o of base.orders) {
      if (["SO-0082", "SO-0069"].includes(o.header.no)) continue;
      expect(order(told, o.header.no)).toEqual(o);
    }
  });

  it("makes SO-0082 one line of 1,000 SSDs at 61.20 for C-1042, with PO 4471-26", () => {
    const o = order(told, "SO-0082");
    expect(o.header.sellToCustomerNo).toBe("C-1042");
    expect(o.header.externalDocumentNo).toBe("4471-26");
    expect(o.shipTo.name).toBe("Meridian Vale Technologies Pvt Ltd");
    expect(o.lines).toHaveLength(1);
    expect(o.lines[0]).toMatchObject({
      no: "I-0075",
      description: "Samsung SSD 1 TB NVMe",
      quantity: "1000",
      unitPrice: "61.20",
      lineAmount: "61200.00",
    });
    expect(o.total).toBe("61200.00");
    expect(o.documents.find((d) => d.type === "CUSTOMER_PO")?.number).toBe(
      "4471-26",
    );
    expect(o.sampleScreenState).toBe("sample-short-stock");
  });

  it("keeps SO-0082 short of stock, by what the item cannot cover", () => {
    const o = order(told, "SO-0082");
    const item = told.items.find((i) => i.no === "I-0075");
    if (!item) throw new Error("No I-0075");
    const available = availableStock(item);
    expect(Number(available)).toBeLessThan(1000);
    expect(o.stockShortfall).toEqual({
      itemNo: "I-0075",
      ordered: "1000",
      availableStock: available,
      shortBy: addDecimal("1000", `-${available}`),
    });
    expect(o.scenario).toMatchObject({
      kind: "short-stock",
      itemNo: "I-0075",
      ordered: "1000",
      inStock: String(Number(available)),
      shortBy: o.stockShortfall?.shortBy,
    });
  });

  it("makes the SPR the shortfall at the item's cost, from the item's vendor", () => {
    const o = order(told, "SO-0082");
    const spr = told.sprs.find((s) => s.orderNo === "SO-0082");
    const item = told.items.find((i) => i.no === "I-0075");
    expect(spr?.status).toBe("suggested");
    expect(spr?.itemNo).toBe("I-0075");
    expect(spr?.vendorNo).toBe(item?.vendorNo);
    expect(spr?.quantity).toBe(o.stockShortfall?.shortBy);
    expect(spr?.unitCost).toBe(item?.unitCost);
    expect(spr?.amount).toBe(
      multiplyDecimal(spr?.quantity ?? "0", spr?.unitCost ?? "0"),
    );
    expect(spr?.basis.shortfall).toBe(spr?.quantity);
    expect(spr?.requestedBy).toBe(o.owners.productManager);
  });

  it("carries the storyline into the tasks of SO-0082", () => {
    const spr = told.sprs.find((s) => s.orderNo === "SO-0082");
    const task = told.tasks.find((t) => t.orderNo === "SO-0082");
    expect(task).toMatchObject({
      kind: "RAISE_SPR",
      customerNo: "C-1042",
      customerName: "Meridian Vale Technologies Pvt Ltd",
      amount: spr?.amount,
      assigneeName: spr?.requestedBy,
    });
  });

  it("makes SO-0069 an SSD line at 61.20 with the quantity it had", () => {
    const was = order(base, "SO-0069");
    const o = order(told, "SO-0069");
    expect(o.lines[0]).toMatchObject({
      no: "I-0075",
      quantity: was.lines[0]?.quantity,
      unitPrice: "61.20",
    });
    expect(o.lines.slice(1)).toEqual(was.lines.slice(1));
    expect(o.scenario).toEqual({
      kind: "pi-price-mismatch",
      itemNo: "I-0075",
      poPrice: "61.20",
      piPrice: "64.80",
    });
  });

  it("states each total as the sum of its lines", () => {
    for (const no of ["SO-0082", "SO-0069"]) {
      const o = order(told, no);
      expect(o.total).toBe(sumDecimal(o.lines.map((l) => l.lineAmount)));
      for (const l of o.lines)
        expect(l.lineAmount).toBe(multiplyDecimal(l.quantity, l.unitPrice));
    }
    const task = told.tasks.find((t) => t.orderNo === "SO-0069");
    expect(task?.amount).toBe(order(told, "SO-0069").total);
  });

  it("says the PI price exception in the storyline's figures", () => {
    const exception = told.exceptions.find((e) => e.orderNo === "SO-0069");
    expect(exception).toMatchObject({
      state: "OPEN",
      ruleId: "mock.sample-price",
      expected: "61.20",
      found: "64.80",
      difference: "3.60 USD a unit",
      summary: "Item I-0075: the PI prints 64.80, the PO says 61.20",
    });
  });

  it("keeps Qty. on Sales Order equal to the open demand it had, line by line", () => {
    const moved = new Map<string, number>();
    const note = (no: string, by: number) =>
      moved.set(no, (moved.get(no) ?? 0) + by);
    for (const line of order(base, "SO-0069").lines.slice(0, 1))
      note(line.no, -Number(line.quantity));
    note("I-0075", 80);
    // SO-0082 had a counted line on I-0221 and one on I-0169; its short line was never counted.
    note("I-0221", -10);
    note("I-0169", -50);
    for (const item of told.items) {
      const was = base.items.find((i) => i.no === item.no);
      expect(Number(item.qtyOnSalesOrder)).toBe(
        Number(was?.qtyOnSalesOrder) + (moved.get(item.no) ?? 0),
      );
    }
  });

  it("does not change the dataset it is given", () => {
    const fresh = createSyntheticDataset();
    withDemoStoryline(fresh);
    expect(fresh).toEqual(createSyntheticDataset());
  });

  it("is off until it is switched on, and off again when it is switched off", () => {
    const reference = { referenceDate: AS_OF };
    const plain = syntheticDataset(reference);
    expect(order(plain, "SO-0082").header.sellToCustomerNo).toBe("C-0006");
    setDemoStoryline(true);
    const on = syntheticDataset(reference);
    expect(order(on, "SO-0082").header.sellToCustomerNo).toBe("C-1042");
    expect(syntheticDataset(reference)).toBe(on);
    setDemoStoryline(false);
    expect(syntheticDataset(reference)).toBe(plain);
    expect(order(plain, "SO-0082").header.externalDocumentNo).not.toBe(
      "4471-26",
    );
  });
});
