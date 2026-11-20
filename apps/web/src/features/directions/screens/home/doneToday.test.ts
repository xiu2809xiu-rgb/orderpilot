import type { WorkflowTask } from "@orderpilot/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { doneKey, forgetDone, readDone, recordDone } from "./doneToday";
import { makeTask } from "./homeTestKit";

// Singapore is 8 hours ahead of UTC and has no daylight saving.
const NOON = new Date("2026-11-20T04:00:00.000Z");
const ANNA = "00000000-0000-4000-8000-0000000000a1";
const BEN = "00000000-0000-4000-8000-0000000000b2";

const sent = (orderNo: string): WorkflowTask =>
  makeTask({ kind: "SEND_PI", orderNo });

beforeEach(() => {
  localStorage.clear();
});

describe("Done today, kept in the browser per person", () => {
  it("is still there when read again, as after a reload, newest first", () => {
    recordDone(ANNA, sent("SO-0001"), new Date("2026-11-20T02:00:00.000Z"));
    recordDone(ANNA, sent("SO-0002"), NOON);
    const items = readDone(ANNA, NOON);
    expect(items.map((item) => item.orderNo)).toEqual(["SO-0002", "SO-0001"]);
    expect(items[0]).toMatchObject({
      kind: "SEND_PI",
      orderNo: "SO-0002",
      at: NOON,
    });
  });

  it("belongs to one person: another reads none of it", () => {
    recordDone(ANNA, sent("SO-0001"), NOON);
    expect(readDone(BEN, NOON)).toEqual([]);
    expect(localStorage.getItem(doneKey(BEN))).toBeNull();
  });

  it("drops another day's entries when read, by the Singapore date", () => {
    recordDone(ANNA, sent("SO-0001"), NOON);
    // 17:00 UTC on the 20th is 01:00 on the 21st in Singapore: a new day.
    const nextDay = new Date("2026-11-20T17:00:00.000Z");
    expect(readDone(ANNA, nextDay)).toEqual([]);
    // 15:59 UTC on the 20th is still the 20th in Singapore.
    expect(readDone(ANNA, new Date("2026-11-20T15:59:00.000Z"))).toHaveLength(
      1,
    );
    // Yesterday's entry does not come back with today's first act.
    const afterwards = recordDone(ANNA, sent("SO-0002"), nextDay);
    expect(afterwards.map((item) => item.orderNo)).toEqual(["SO-0002"]);
  });

  it("takes the newest note of a task out again on Undo, and no other", () => {
    recordDone(ANNA, sent("SO-0001"), NOON);
    recordDone(ANNA, sent("SO-0002"), NOON);
    const items = forgetDone(ANNA, sent("SO-0002"));
    expect(items.map((item) => item.orderNo)).toEqual(["SO-0001"]);
    expect(readDone(ANNA).map((item) => item.orderNo)).toEqual(["SO-0001"]);
  });

  it("starts empty when the stored copy is broken or the kind is unknown", () => {
    localStorage.setItem(doneKey(ANNA), "{not json");
    expect(readDone(ANNA, NOON)).toEqual([]);
    localStorage.setItem(
      doneKey(ANNA),
      JSON.stringify([
        { kind: "NOT_A_KIND", orderNo: "SO-0001", at: NOON.toISOString() },
      ]),
    );
    expect(readDone(ANNA, NOON)).toEqual([]);
  });

  it("holds the kind, the order and the time, and the customer for the line's second word", () => {
    recordDone(ANNA, sent("SO-0001"), NOON);
    const stored: unknown = JSON.parse(
      localStorage.getItem(doneKey(ANNA)) ?? "null",
    );
    expect(stored).toEqual([
      {
        kind: "SEND_PI",
        orderNo: "SO-0001",
        customerName: "Synthetic Harbour Traders",
        at: NOON.toISOString(),
      },
    ]);
  });

  it("notes nothing for a person who is not signed in", () => {
    expect(recordDone(null, sent("SO-0001"), NOON)).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
});
