import type {
  SalesFlow,
  SalesOrderRow,
  TrackerOrder,
} from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  ageInDays,
  isHeldUp,
  isOpen,
  joinOrders,
  positionOf,
  stepOfStatus,
} from "./orderRow";

const FLOW: SalesFlow = {
  openOrders: 3,
  steps: [
    { id: "poIn", statuses: ["a", "b"], count: 1 },
    { id: "stock", statuses: ["c"], count: 1 },
    { id: "pi", statuses: ["d"], count: 1 },
    { id: "payment", statuses: ["e"], count: 0 },
    { id: "pack", statuses: ["f"], count: 0 },
    { id: "documents", statuses: ["g"], count: 0 },
    { id: "forwarder", statuses: ["h"], count: 0 },
    { id: "customerTold", statuses: ["i"], count: 0 },
    { id: "awbAndPermit", statuses: ["j"], count: 0 },
  ],
};

const order = (
  orderNo: string,
  patch: Partial<SalesOrderRow> = {},
): SalesOrderRow => ({
  orderNo,
  source: "sample",
  captureState: null,
  customerNo: "C-0001",
  customerName: "Customer",
  externalDocumentNo: "PO-1",
  orderDate: "2026-11-10",
  shipmentDate: null,
  workflowStatus: null,
  amount: {
    field: "item.unitPrice",
    classification: "confidential",
    masked: true,
    value: null,
    reason: "price",
  },
  currencyCode: "USD",
  shortage: null,
  shortageCount: 0,
  ...patch,
});

const tracked = (
  orderNo: string,
  code: string,
  patch: Partial<TrackerOrder> = {},
): TrackerOrder => ({
  orderNo,
  externalDocumentNo: "PO-1",
  customerNo: "C-0001",
  customerName: "Customer",
  status: { code, label: code },
  ownerRole: "SUPPORT",
  overdue: { overdue: false, daysOverdue: 0, reason: null },
  openExceptions: 0,
  shipmentDate: null,
  orderDate: "2026-11-10",
  amount: "999.00",
  currencyCode: "USD",
  ...patch,
});

describe("stepOfStatus", () => {
  it("reads the step from the tracker flow", () => {
    expect(stepOfStatus(FLOW, "a")).toBe(1);
    expect(stepOfStatus(FLOW, "c")).toBe(2);
    expect(stepOfStatus(FLOW, "j")).toBe(9);
  });
  it("calls a status the flow does not list a finished order", () => {
    expect(stepOfStatus(FLOW, "closed")).toBe(10);
  });
  it("has no step before the flow is loaded or for an unknown order", () => {
    expect(stepOfStatus(undefined, "a")).toBeNull();
    expect(stepOfStatus(FLOW, null)).toBeNull();
  });
});

describe("joinOrders", () => {
  const rows = joinOrders({
    orders: [order("SO-1"), order("SO-2"), order("SO-3", { source: "stored" })],
    tracker: [
      tracked("SO-1", "c", { openExceptions: 2 }),
      tracked("SO-2", "closed"),
    ],
    toConfirm: new Set(["SO-1"]),
    flow: FLOW,
  });
  const [first, second, third] = rows;

  it("keeps every order of the Orders list, in its order", () => {
    expect(rows.map((row) => row.orderNo)).toEqual(["SO-1", "SO-2", "SO-3"]);
  });
  it("adds what the tracker knows and keeps the masked amount of the Orders list", () => {
    expect(first).toMatchObject({
      ownerRole: "SUPPORT",
      openExceptions: 2,
      toConfirm: true,
      step: 2,
    });
    // The tracker's own amount is not masked, so it must never be the one shown.
    expect(first?.amount.masked).toBe(true);
    expect(first?.amount.value).toBeNull();
  });
  it("leaves a draft the tracker does not know without a step or a team", () => {
    expect(third).toMatchObject({ status: null, ownerRole: null, step: null });
  });
  it("says what is held up and what is open", () => {
    expect(first && isHeldUp(first)).toBe(true);
    expect(second && isHeldUp(second)).toBe(false);
    expect(first && isOpen(first)).toBe(true);
    expect(second && isOpen(second)).toBe(false);
    expect(third && isOpen(third)).toBe(true);
  });
});

describe("ageInDays and positionOf", () => {
  it("counts calendar days and never goes below zero", () => {
    expect(ageInDays("2026-11-10", "2026-11-13")).toBe(3);
    expect(ageInDays("2026-11-13", "2026-11-13")).toBe(0);
    expect(ageInDays("2026-11-20", "2026-11-13")).toBe(0);
  });
  it("finds a step by its tracker id", () => {
    expect(positionOf("poIn")).toBe(1);
    expect(positionOf("awbAndPermit")).toBe(9);
    expect(positionOf("nope")).toBeNull();
  });
});
