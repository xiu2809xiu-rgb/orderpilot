import { beforeAll, describe, expect, it } from "vitest";
import i18n from "@/i18n";
import { heldLine, heldReasons } from "./heldReasons";
import { loadNamespaces, makeRow } from "./ordersTestKit";

beforeAll(loadNamespaces);

const t = () => i18n.getFixedT("en", "directions-orders");

const SHORT = {
  itemNo: "I-0190",
  ordered: "1200.00",
  availableStock: "493.00",
  shortBy: "707.00",
};

describe("why a held order is held", () => {
  it("says the shortage from the row's own figures", () => {
    const row = makeRow({ shortage: SHORT, shortageCount: 1, step: 2 });
    expect(heldReasons(row, t())).toEqual(["707 short"]);
  });

  // The row holds no payment, only the step its status belongs to. Finance can
  // have confirmed the payment while the status has not moved yet, so the line
  // would say what is not true.
  it("says nothing about a payment, whatever step the order is at", () => {
    expect(heldReasons(makeRow({ step: 4 }), t())).toEqual([]);
    expect(heldReasons(makeRow({ step: 4, openExceptions: 1 }), t())).toEqual([
      "1 open exception",
    ]);
  });

  it("says the open exceptions as a count, never as a kind the row cannot know", () => {
    const row = makeRow({ step: 9, openExceptions: 2 });
    expect(heldReasons(row, t())).toEqual(["2 open exceptions"]);
  });

  it("lists the reasons in the order a person would fix them", () => {
    const row = makeRow({
      step: 4,
      shortage: SHORT,
      shortageCount: 1,
      openExceptions: 1,
    });
    const reasons = heldReasons(row, t());
    expect(reasons).toEqual(["707 short", "1 open exception"]);
    expect(heldLine(reasons, t())).toBe("707 short and 1 more");
  });

  it("says nothing for an order that is not held up, even when it is short", () => {
    const row = makeRow({
      overdue: { overdue: false, daysOverdue: 0, reason: null },
      shortage: SHORT,
      shortageCount: 1,
    });
    expect(heldReasons(row, t())).toEqual([]);
  });

  it("says nothing where the row cannot say why", () => {
    // Late, with no shortage and no exception.
    const row = makeRow({ step: 6 });
    expect(heldReasons(row, t())).toEqual([]);
    expect(heldLine([], t())).toBe("");
  });
});
