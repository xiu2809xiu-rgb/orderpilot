import { describe, expect, it } from "vitest";
import { MockDecisionOverlay } from "./mock-decision-overlay.js";

const TASK = "00000000-0000-4000-8000-000000000001";
const SPR = "SPR-20261102-0001";
const decision = (comment: string) => ({
  outcome: "approved" as const,
  by: "A Person",
  comment,
  at: "2026-11-02T01:00:00.000Z",
});
const payment = (id: string) => ({
  id,
  orderNo: "SO-0001",
  paymentType: "prepayment" as const,
  amount: "100.00",
  currencyCode: "USD",
  reference: "TT-1",
  paidOn: "2026-11-02",
  confirmedAt: "2026-11-02T01:00:00.000Z",
  confirmedBy: "A Person",
});

describe("the mock decision overlay", () => {
  it("closes and reopens a task, and says when there was nothing to undo", () => {
    const overlay = new MockDecisionOverlay();
    overlay.closeTask(TASK);
    expect(overlay.isClosed(TASK)).toBe(true);
    expect(overlay.reopenTask(TASK)).toBe(true);
    expect(overlay.isClosed(TASK)).toBe(false);
    expect(overlay.reopenTask(TASK)).toBe(false);
  });

  it("gives the task back when a decision is undone", () => {
    const overlay = new MockDecisionOverlay();
    overlay.recordDecision(SPR, decision("first"), TASK);
    expect(overlay.decisionOf(SPR)?.comment).toBe("first");
    expect(overlay.isClosed(TASK)).toBe(true);

    expect(overlay.undoDecision(SPR)).toBe(true);
    expect(overlay.decisionOf(SPR)).toBeNull();
    expect(overlay.isClosed(TASK)).toBe(false);
    expect(overlay.undoDecision(SPR)).toBe(false);
  });

  it("lets only the payment that closed a task reopen it", () => {
    const overlay = new MockDecisionOverlay();
    overlay.recordPayment(payment("p1"), TASK);
    overlay.recordPayment(payment("p2"), TASK);
    expect(overlay.paymentsOf("SO-0001")).toHaveLength(2);

    expect(overlay.undoPayment("SO-0001", "p2")).toBe(true);
    expect(overlay.isClosed(TASK)).toBe(true);
    expect(overlay.undoPayment("SO-0001", "p1")).toBe(true);
    expect(overlay.isClosed(TASK)).toBe(false);
  });

  it("will not undo a payment through another order", () => {
    const overlay = new MockDecisionOverlay();
    overlay.recordPayment(payment("p1"), null);
    expect(overlay.undoPayment("SO-0002", "p1")).toBe(false);
    expect(overlay.paymentsOf("SO-0001")).toHaveLength(1);
  });

  it("forgets everything on a new day, when the ids may name other tasks", () => {
    const overlay = new MockDecisionOverlay();
    overlay.startDay("2026-11-02");
    overlay.closeTask(TASK);
    overlay.recordDecision(SPR, decision("kept"), null);
    overlay.startDay("2026-11-02");
    expect(overlay.isClosed(TASK)).toBe(true);
    overlay.startDay("2026-11-03");
    expect(overlay.isClosed(TASK)).toBe(false);
    expect(overlay.decisionOf(SPR)).toBeNull();
  });
});
