import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../common/domain-error.js";
import type { CustomerLookup } from "../master-data/customer-lookup.js";
import type { StockLookup } from "../master-data/stock-lookup.js";
import type { WorkflowOrderStatusReader } from "../workflows/workflow-order-status-reader.js";
import type { OrderDirectory } from "./domain/order-directory.js";
import type { OrderFacts } from "./domain/order-facts.js";
import { OrderMasking } from "./domain/order-masking.js";
import { facts } from "./domain/test-facts.js";
import { OrdersService } from "./orders.service.js";

const line = (itemNo: string, quantity: string) => ({
  lineNo: 1,
  itemNo,
  description: "Item",
  quantity,
  unitPrice: "10.00",
  qtyToShip: quantity,
});

function service(
  orders: OrderFacts[],
  stock: Record<string, string>,
  names: Record<string, string> = {},
  held: Record<string, string> = {},
  readerFails: Error | null = null,
) {
  const asked: string[][] = [];
  const listed: (string | undefined)[] = [];
  const nameAsks: string[][] = [];
  const directory: OrderDirectory = {
    list: (options) => {
      listed.push(options?.source);
      return Promise.resolve(orders);
    },
    find: (no) => Promise.resolve(orders.find((o) => o.orderNo === no) ?? null),
  };
  const lookup = {
    availableStockOf: (itemNos: readonly string[]) => {
      asked.push([...itemNos]);
      return Promise.resolve(new Map(Object.entries(stock)));
    },
  } as unknown as StockLookup;
  const customers = {
    namesOf: (nos: readonly string[]) => {
      nameAsks.push([...nos]);
      return Promise.resolve(new Map(Object.entries(names)));
    },
  } as unknown as CustomerLookup;
  const workflowAsks: string[][] = [];
  const workflow = {
    statusOfMany: (nos: readonly string[]) => {
      workflowAsks.push([...nos]);
      if (readerFails) return Promise.reject(readerFails);
      return Promise.resolve(
        new Map(
          nos
            .filter((no) => no in held)
            .map((no) => [
              no,
              { status: { code: "Received", label: held[no] } },
            ]),
        ),
      );
    },
  } as unknown as WorkflowOrderStatusReader;
  return {
    svc: new OrdersService(
      directory,
      lookup,
      customers,
      new OrderMasking(),
      workflow,
    ),
    asked,
    listed,
    nameAsks,
    workflowAsks,
  };
}

const query = { page: 1, pageSize: 25 };
const gap = {
  itemNo: "I-9",
  ordered: "9",
  availableStock: "4",
  shortBy: "5",
};
const waitingSample = facts({
  orderNo: "SO-0001",
  source: "sample",
  captureState: null,
  stockShortfall: { ...gap, coveredBy: null },
});
const coveredSample = facts({
  orderNo: "SO-0002",
  source: "sample",
  captureState: null,
  stockShortfall: { ...gap, coveredBy: "PO-1" },
});
const shortStored = facts({
  orderNo: "SO-20261108-0001",
  lines: [line("I-1", "8.000")],
});

describe("the orders service", () => {
  it("reports a sample waiting on its SPR as short, and a covered one as not", async () => {
    const { svc } = service([waitingSample, coveredSample], {});
    const page = await svc.list({ ...query, stock: "waiting" }, "SUPPORT");
    expect(page.items.map((r) => r.orderNo)).toEqual(["SO-0001"]);
    expect(page.items[0]).toMatchObject({
      shortageCount: 1,
      shortage: { itemNo: "I-9", shortBy: "5.00" },
    });
  });

  it("writes a sample's shortage the way a stored order's is written", async () => {
    const odd = facts({
      orderNo: "SO-0009",
      source: "sample",
      captureState: null,
      stockShortfall: {
        itemNo: "I-9",
        ordered: "64",
        availableStock: "47.00",
        shortBy: "17",
        coveredBy: null,
      },
    });
    const { svc } = service([odd, shortStored], { "I-1": "5.00" });
    const page = await svc.list({ ...query, stock: "waiting" }, "SUPPORT");
    const [sample, stored] = page.items;
    expect(sample?.shortage).toEqual({
      itemNo: "I-9",
      ordered: "64.00",
      availableStock: "47.00",
      shortBy: "17.00",
    });
    expect(stored?.shortage?.ordered).toMatch(/^\d+\.\d{2}$/);
  });

  it("asks the directory for one kind only when the filter names it", async () => {
    const { svc, listed } = service([waitingSample], {});
    await svc.list({ ...query, source: "sample" }, "SUPPORT");
    await svc.list(query, "SUPPORT");
    expect(listed).toEqual(["sample", undefined]);
  });

  it("puts a customer's name beside its number, from the sample or from master data", async () => {
    const named = facts({
      orderNo: "SO-0003",
      source: "sample",
      captureState: null,
      customerNo: "C-0007",
      customerName: "Sample Named Ltd",
    });
    const { svc, nameAsks } = service(
      [named, shortStored],
      {},
      {
        "C-0001": "Stored Customer Pte",
      },
    );
    const page = await svc.list(query, "SUPPORT");
    const names = Object.fromEntries(
      page.items.map((r) => [r.orderNo, r.customerName]),
    );
    expect(names).toEqual({
      "SO-0003": "Sample Named Ltd",
      "SO-20261108-0001": "Stored Customer Pte",
    });
    // Only the number is sent to master data, and only for rows with no name.
    expect(nameAsks).toEqual([["C-0001"]]);
    const detail = await svc.one("SO-20261108-0001", "SUPPORT");
    expect(detail.customerName).toBe("Stored Customer Pte");
  });

  it("judges a stored order against stock and reports the gap", async () => {
    const { svc } = service([shortStored], { "I-1": "5.00" });
    const page = await svc.list(query, "SUPPORT");
    expect(page.items[0]?.shortage).toMatchObject({
      itemNo: "I-1",
      shortBy: "3.00",
    });
  });

  it("does not look up stock for a void order or for samples alone", async () => {
    const { svc, asked } = service(
      [waitingSample, facts({ captureState: "void" })],
      {},
    );
    await svc.list(query, "SUPPORT");
    expect(asked).toHaveLength(0);
  });

  it("counts the total after filtering, and pages from there", async () => {
    const { svc } = service([waitingSample, coveredSample, shortStored], {});
    const page = await svc.list(
      { page: 2, pageSize: 2, source: "sample" },
      "SUPPORT",
    );
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(0);
  });

  it("masks the amount by role, in rows and in lines", async () => {
    const { svc } = service([shortStored], { "I-1": "50" });
    const rows = await svc.list(query, "WAREHOUSE");
    expect(rows.items[0]?.amount).toMatchObject({
      masked: true,
      value: null,
      reason: "price",
    });
    const detail = await svc.one("SO-20261108-0001", "WAREHOUSE");
    expect(detail.lines[0]?.unitPrice.masked).toBe(true);
    expect(detail.lines[0]?.lineAmount.masked).toBe(true);
    const seen = await svc.one("SO-20261108-0001", "SUPPORT");
    expect(seen.lines[0]).toMatchObject({
      unitPrice: { value: "10.00" },
      lineAmount: { value: "80.00" },
    });
  });

  it("names the short line in the detail", async () => {
    const { svc } = service([shortStored], { "I-1": "5.00" });
    const detail = await svc.one("SO-20261108-0001", "SUPPORT");
    expect(detail.lines[0]?.shortBy).toBe("3.00");
  });

  it("raises not found for an order nobody has", async () => {
    const { svc } = service([], {});
    await expect(svc.one("SO-20990101-0001", "SUPPORT")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  describe("the workflow's label on a submitted stored order", () => {
    const submitted = (no: string, patch: Partial<OrderFacts> = {}) =>
      facts({ orderNo: no, captureState: "submitted", ...patch });

    it("gives a submitted stored order the workflow's label, and null when the workflow does not hold it", async () => {
      const { svc } = service(
        [submitted("SO-20261108-0010"), submitted("SO-20261108-0011")],
        {},
        {},
        { "SO-20261108-0010": "PO received" },
      );
      const page = await svc.list(query, "SUPPORT");
      const labels = Object.fromEntries(
        page.items.map((r) => [r.orderNo, r.workflowStatus]),
      );
      expect(labels).toEqual({
        "SO-20261108-0010": "PO received",
        "SO-20261108-0011": null,
      });
      const held = await svc.one("SO-20261108-0010", "SUPPORT");
      expect(held.workflowStatus).toBe("PO received");
      const free = await svc.one("SO-20261108-0011", "SUPPORT");
      expect(free.workflowStatus).toBeNull();
    });

    it("asks the workflow once for the submitted stored orders of the page it shows, and not at all when there is none", async () => {
      const { svc, workflowAsks } = service(
        [
          submitted("SO-20261108-0010"),
          submitted("SO-20261108-0011"),
          shortStored,
        ],
        {},
      );
      await svc.list(query, "SUPPORT");
      expect(workflowAsks).toHaveLength(1);
      expect([...(workflowAsks[0] ?? [])].sort()).toEqual([
        "SO-20261108-0010",
        "SO-20261108-0011",
      ]);
      const quiet = service([shortStored, waitingSample], {});
      await quiet.svc.list(query, "SUPPORT");
      expect(quiet.workflowAsks).toHaveLength(0);
    });

    it("does not ask for the orders outside the page", async () => {
      const { svc, workflowAsks } = service(
        [
          submitted("SO-20261108-0010"),
          submitted("SO-20261108-0011"),
          submitted("SO-20261108-0012"),
        ],
        {},
      );
      const page = await svc.list({ page: 2, pageSize: 1 }, "SUPPORT");
      expect(page.items).toHaveLength(1);
      expect(workflowAsks).toEqual([[page.items[0]?.orderNo]]);
    });

    it("never asks for a draft, a void order or a sample", async () => {
      const { svc, workflowAsks } = service(
        [
          shortStored,
          facts({ orderNo: "SO-20261108-0020", captureState: "void" }),
          waitingSample,
        ],
        {},
      );
      await svc.list(query, "SUPPORT");
      await svc.one("SO-20261108-0020", "SUPPORT");
      await svc.one("SO-0001", "SUPPORT");
      expect(workflowAsks).toHaveLength(0);
    });

    it("a submitted stored order with a shortage still reports it after the label is filled", async () => {
      const { svc } = service(
        [submitted("SO-20261108-0010", { lines: [line("I-1", "8.000")] })],
        { "I-1": "5.00" },
        {},
        { "SO-20261108-0010": "PO received" },
      );
      const page = await svc.list(query, "SUPPORT");
      expect(page.items[0]).toMatchObject({
        workflowStatus: "PO received",
        shortageCount: 1,
        shortage: { itemNo: "I-1", shortBy: "3.00" },
      });
      const detail = await svc.one("SO-20261108-0010", "SUPPORT");
      expect(detail.shortageCount).toBe(1);
    });

    it("rejects the whole list when the label reader rejects, and says nothing false in its place", async () => {
      // Chosen (ADR 0073): a swallowed failure would show "No team has a task
      // for it" for an order that a team may hold.
      const { svc } = service(
        [submitted("SO-20261108-0010")],
        {},
        {},
        {},
        new Error("the label reader is down"),
      );
      await expect(svc.list(query, "SUPPORT")).rejects.toThrow(
        "the label reader is down",
      );
      await expect(svc.one("SO-20261108-0010", "SUPPORT")).rejects.toThrow(
        "the label reader is down",
      );
    });
  });
});
