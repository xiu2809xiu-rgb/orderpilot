import { describe, expect, it } from "vitest";
import { sortOrders } from "./order-sorter.js";
import { entry } from "./test-facts.js";

const a = entry({
  orderNo: "SO-0002",
  captureState: null,
  orderDate: "2026-10-01",
  total: "30.00",
  customerNo: "C-2",
  shipmentDate: null,
});
const b = entry({
  orderNo: "SO-0010",
  captureState: null,
  orderDate: "2026-10-01",
  total: "5.00",
  customerNo: "C-1",
  shipmentDate: "2026-11-01",
});
const c = entry({
  orderNo: "SO-20261108-0001",
  orderDate: "2026-11-08",
  total: "200.00",
  customerNo: "C-3",
  captureState: "draft",
});
const rows = [a, b, c];
const order = (list: readonly { facts: { orderNo: string } }[]) =>
  list.map((r) => r.facts.orderNo);

describe("the order sorter", () => {
  it("puts the newest first by default and breaks ties by number", () => {
    expect(order(sortOrders(rows, {}, true))).toEqual([
      "SO-20261108-0001",
      "SO-0002",
      "SO-0010",
    ]);
  });

  it("compares numbers as numbers, so SO-0002 comes before SO-0010", () => {
    expect(order(sortOrders(rows, { sort: "orderNo" }, true))).toEqual([
      "SO-0002",
      "SO-0010",
      "SO-20261108-0001",
    ]);
  });

  it("sorts each column both ways", () => {
    const amountUp = { sort: "amount", direction: "asc" } as const;
    const amountDown = { sort: "amount", direction: "desc" } as const;
    expect(order(sortOrders(rows, amountUp, true))).toEqual([
      "SO-0010",
      "SO-0002",
      "SO-20261108-0001",
    ]);
    expect(order(sortOrders(rows, amountDown, true))).toEqual([
      "SO-20261108-0001",
      "SO-0002",
      "SO-0010",
    ]);
    expect(order(sortOrders(rows, { sort: "customerNo" }, true))).toEqual([
      "SO-0010",
      "SO-0002",
      "SO-20261108-0001",
    ]);
    expect(order(sortOrders(rows, { sort: "shipmentDate" }, true))[2]).toBe(
      "SO-0010",
    );
    const state = { sort: "captureState", direction: "desc" } as const;
    expect(order(sortOrders(rows, state, true))[0]).toBe("SO-20261108-0001");
  });

  it("keeps the number in ascending order on a tie, whichever way it sorts", () => {
    const down = { sort: "orderDate", direction: "desc" } as const;
    const up = { sort: "orderDate", direction: "asc" } as const;
    expect(order(sortOrders(rows, down, true)).slice(1)).toEqual([
      "SO-0002",
      "SO-0010",
    ]);
    expect(order(sortOrders(rows, up, true)).slice(0, 2)).toEqual([
      "SO-0002",
      "SO-0010",
    ]);
  });

  it("falls back to the default order when amounts are hidden, so their order does not leak", () => {
    expect(sortOrders(rows, { sort: "amount" }, false)).toEqual(
      sortOrders(rows, {}, true),
    );
    expect(
      sortOrders(rows, { sort: "amount", direction: "asc" }, false),
    ).toEqual(sortOrders(rows, { direction: "asc" }, true));
  });

  it("does not change the list it is given", () => {
    const before = [...rows];
    sortOrders(rows, { sort: "amount" }, true);
    expect(rows).toEqual(before);
  });
});
