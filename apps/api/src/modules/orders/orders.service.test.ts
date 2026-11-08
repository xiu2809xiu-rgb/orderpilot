import { describe, expect, it } from "vitest";
import { NotFoundError } from "../../common/domain-error.js";
import type { StockLookup } from "../master-data/stock-lookup.js";
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

function service(orders: OrderFacts[], stock: Record<string, string>) {
  const asked: string[][] = [];
  const directory: OrderDirectory = {
    list: () => Promise.resolve(orders),
    find: (no) => Promise.resolve(orders.find((o) => o.orderNo === no) ?? null),
  };
  const lookup = {
    availableStockOf: (itemNos: readonly string[]) => {
      asked.push([...itemNos]);
      return Promise.resolve(new Map(Object.entries(stock)));
    },
  } as unknown as StockLookup;
  return {
    svc: new OrdersService(directory, lookup, new OrderMasking()),
    asked,
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
      shortage: { itemNo: "I-9", shortBy: "5" },
    });
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
});
