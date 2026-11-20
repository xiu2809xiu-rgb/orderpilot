import { describe, expect, it } from "vitest";
import { filterOrders } from "./order-filter.js";
import { entry } from "./test-facts.js";

const query = { page: 1, pageSize: 25 };
const gap = { itemNo: "I-1", ordered: "5", availableStock: "2", shortBy: "3" };

const sample = entry({
  orderNo: "SO-0007",
  source: "sample",
  captureState: null,
  customerNo: "C-0002",
  externalDocumentNo: "ACME-77",
  orderDate: "2026-10-01",
  total: "500.00",
});
const draft = entry({ orderNo: "SO-20261108-0001", total: "100.00" });
const submitted = entry(
  { orderNo: "SO-20261108-0002", captureState: "submitted" },
  [gap],
);
const all = [sample, draft, submitted];
const numbers = (rows: readonly { facts: { orderNo: string } }[]) =>
  rows.map((r) => r.facts.orderNo);
const apply = (patch: object, canSee = true) =>
  filterOrders(all, { ...query, ...patch }, canSee);

describe("the order filter", () => {
  it("keeps everything with no filter", () => {
    expect(apply({})).toHaveLength(3);
  });

  it("searches the number, the customer and the PO number, ignoring case", () => {
    expect(numbers(apply({ search: "acme" }))).toEqual(["SO-0007"]);
    expect(numbers(apply({ search: "c-0001" }))).toEqual([
      "SO-20261108-0001",
      "SO-20261108-0002",
    ]);
    expect(numbers(apply({ search: "0002" }))).toEqual([
      "SO-0007",
      "SO-20261108-0002",
    ]);
  });

  it("searches the customer's name too, and skips an order that carries none", () => {
    const named = entry({
      orderNo: "SO-0042",
      customerNo: "C-1042",
      customerName: "Meridian Vale Technologies Pvt Ltd",
    });
    const found = filterOrders(
      [...all, named],
      { ...query, search: "meridian" },
      true,
    );
    expect(numbers(found)).toEqual(["SO-0042"]);
  });

  it("matches a customer exactly, not by a part of the number", () => {
    expect(apply({ customerNo: "C-000" })).toHaveLength(0);
    expect(apply({ customerNo: "C-0002" })).toHaveLength(1);
  });

  it("never matches a sample to a capture state", () => {
    expect(numbers(apply({ captureState: "draft" }))).toEqual([
      "SO-20261108-0001",
    ]);
  });

  it("filters by source and by order date, both ends included", () => {
    expect(numbers(apply({ source: "sample" }))).toEqual(["SO-0007"]);
    expect(
      numbers(
        apply({ orderDateFrom: "2026-10-01", orderDateTo: "2026-10-01" }),
      ),
    ).toEqual(["SO-0007"]);
  });

  it("keeps only the orders waiting on stock for stock=waiting", () => {
    expect(numbers(apply({ stock: "waiting" }))).toEqual(["SO-20261108-0002"]);
  });

  it("filters by an amount range, both ends included", () => {
    expect(
      numbers(apply({ amountFrom: "100.00", amountTo: "100.00" })),
    ).toEqual(["SO-20261108-0001", "SO-20261108-0002"]);
  });

  it("ignores an amount range for a role that cannot see amounts", () => {
    expect(apply({ amountFrom: "400" }, false)).toHaveLength(3);
  });
});
