import type { TimelineStep } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { STEP_TIMES } from "../../data/index";
import { buildJourney } from "./journeyModel";
import { stepBegan } from "./stepBegan";

const done = (key: string, completedAt: string | null) => ({
  key,
  state: "done",
  completedAt,
});

describe("stepBegan", () => {
  it("is the moment the newest finished step before the current one was done, whatever the order of the list", () => {
    expect(
      stepBegan(
        [
          done("po-received", "2026-11-15T08:00:00.000Z"),
          done("pi-sent", "2026-11-16T08:00:00.000Z"),
          done("stock-checked", "2026-11-14T08:00:00.000Z"),
          { key: "payment-confirmed", state: "current", completedAt: null },
          { key: "packed", state: "upcoming", completedAt: null },
        ],
        4,
      ),
    ).toEqual(new Date("2026-11-16T08:00:00.000Z"));
  });

  it("does not count a step that is not done, even if it carries a time", () => {
    expect(
      stepBegan(
        [
          done("pi-sent", "2026-11-14T08:00:00.000Z"),
          {
            key: "stock-checked",
            state: "current",
            completedAt: "2026-11-19T08:00:00.000Z",
          },
        ],
        4,
      ),
    ).toEqual(new Date("2026-11-14T08:00:00.000Z"));
  });

  it("never counts a finished step at the current step or after it", () => {
    const record = [
      done("pi-sent", "2026-11-20T08:00:00.000Z"),
      done("payment-confirmed", "2026-11-21T06:00:00.000Z"),
      done("packed", "2026-11-21T07:00:00.000Z"),
    ];
    // At the payment step: the payment and the packing are not before it.
    expect(stepBegan(record, 4)).toEqual(new Date("2026-11-20T08:00:00.000Z"));
    // At the packing step the payment is before it, the packing is not.
    expect(stepBegan(record, 5)).toEqual(new Date("2026-11-21T06:00:00.000Z"));
    // Every step done: all of them are before it.
    expect(stepBegan(record, 10)).toEqual(new Date("2026-11-21T07:00:00.000Z"));
  });

  it("places each step of the record on the journey's nine, as Home places its tasks", () => {
    const at = (key: string, current: number) =>
      stepBegan([done(key, "2026-11-10T08:00:00.000Z")], current);
    const placed: [string, number][] = [
      ["po-received", 1],
      ["fields-confirmed", 1],
      ["stock-checked", 2],
      ["spr-approval", 2],
      ["pi-sent", 3],
      ["payment-confirmed", 4],
      ["packed", 5],
      ["invoiced", 6],
      ["shipping-documents", 6],
    ];
    for (const [key, position] of placed) {
      // Counts once the order is past its step, never while it is at it.
      expect(at(key, position + 1), key).toBeInstanceOf(Date);
      expect(at(key, position), key).toBeUndefined();
    }
  });

  it("ignores a key it does not know, and never throws on one", () => {
    expect(
      stepBegan(
        [
          done("customs-cleared", "2026-11-19T08:00:00.000Z"),
          done("constructor", "2026-11-19T09:00:00.000Z"),
          done("po-received", "2026-11-12T08:00:00.000Z"),
        ],
        4,
      ),
    ).toEqual(new Date("2026-11-12T08:00:00.000Z"));
  });

  it("has no answer without a finished step before the current one, a time that can be read, or a record", () => {
    expect(
      stepBegan([{ key: "pi-sent", state: "current", completedAt: null }], 4),
    ).toBeUndefined();
    expect(
      stepBegan([done("pi-sent", null), done("pi-sent", "not a time")], 4),
    ).toBeUndefined();
    expect(stepBegan([], 4)).toBeUndefined();
    expect(stepBegan(undefined, 4)).toBeUndefined();
    expect(
      stepBegan([done("pi-sent", "2026-11-14T08:00:00.000Z")], null),
    ).toBeUndefined();
  });
});

// The shape of the fault found on 21 Nov: the PI went out on 20 Nov at 16:00
// in Singapore, Finance confirmed the payment on 21 Nov, and the tracker still
// says the order waits for payment (the stage does not move, #290). The
// journey must go on counting from the PI, not from the payment.
describe("the journey after an act that does not move the order's stage", () => {
  const event = (
    n: number,
    title: string,
    actor: string,
    at: string,
    current = false,
  ): TimelineStep => ({
    id: `e${String(n)}`,
    at,
    actor,
    title,
    effect: "Effect",
    current,
  });
  // The tracker's sample stamps its newest event with today, 21 Nov.
  const EVENTS = [
    event(1, "Customer PO received", "System", "2026-11-12T08:00:00.000Z"),
    event(
      3,
      "Proforma invoice sent",
      "Support",
      "2026-11-21T02:00:00.000Z",
      true,
    ),
  ];
  const PI_SENT = done("pi-sent", "2026-11-20T08:00:00.000Z");
  const PO = done("po-received", "2026-11-12T08:00:00.000Z");
  const PAID = done("payment-confirmed", "2026-11-21T06:00:00.000Z");
  const journeyOf = (record: Parameters<typeof stepBegan>[0]) =>
    buildJourney({
      current: 4,
      events: EVENTS,
      stepTimes: STEP_TIMES.sales,
      today: "2026-11-21",
      since: stepBegan(record, 4),
    });

  it("waits one day from the PI, not here today, and shows no date of today on the PI step", () => {
    const after = journeyOf([PO, PI_SENT, PAID]);
    const payment = after?.steps[3];
    expect(payment?.state).toBe("now");
    expect(payment?.since).toEqual(new Date("2026-11-20T08:00:00.000Z"));
    expect(payment?.waitedDays).toBe(1);
    const pi = after?.steps[2];
    expect(pi?.state).toBe("done");
    expect(pi?.doneBy).toBeNull();
  });

  it("gives the same expected ship day before and after the act", () => {
    const before = journeyOf([PO, PI_SENT]);
    const after = journeyOf([PO, PI_SENT, PAID]);
    expect(before?.ship).not.toBeNull();
    expect(after?.ship).toEqual(before?.ship);
  });
});
