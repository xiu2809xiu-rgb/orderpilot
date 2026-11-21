import { describe, expect, it } from "vitest";
import { calendarDaysBetween, timerParts, waitParts } from "./timer.ts";

const now = new Date("2026-11-13T09:00:00.000Z");
const at = (ms: number) => new Date(now.getTime() + ms);
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

describe("timerParts", () => {
  it("says now inside a minute, either way", () => {
    expect(timerParts(at(30_000), now)).toMatchObject({
      unit: "now",
      late: false,
    });
    expect(timerParts(at(-30_000), now)).toMatchObject({
      unit: "now",
      late: true,
    });
  });

  it("counts minutes under an hour", () => {
    expect(timerParts(at(45 * MIN), now)).toEqual({
      late: false,
      unit: "minutes",
      amount: 45,
      tone: "soon",
    });
  });

  it("counts hours up to two days, to the nearest hour", () => {
    expect(timerParts(at(3 * HOUR + 10 * MIN), now)).toMatchObject({
      unit: "hours",
      amount: 3,
    });
    expect(timerParts(at(47 * HOUR), now)).toMatchObject({
      unit: "hours",
      amount: 47,
    });
  });

  it("counts whole days from two days on, never rounding a late task up", () => {
    expect(timerParts(at(-(2 * DAY + 20 * HOUR)), now)).toEqual({
      late: true,
      unit: "days",
      amount: 2,
      tone: "late",
    });
  });

  it("marks what is due within four hours as soon, and later work as later", () => {
    expect(timerParts(at(4 * HOUR), now).tone).toBe("soon");
    expect(timerParts(at(4 * HOUR + MIN), now).tone).toBe("later");
  });

  it("marks anything past due as late", () => {
    expect(timerParts(at(-HOUR), now)).toMatchObject({
      late: true,
      tone: "late",
      amount: 1,
    });
  });
});

// Singapore is 8 hours ahead of UTC with no daylight saving, so its midnight is
// 16:00 UTC. One moment on each side of it: 23:59 on 20 Nov and 00:01 on 21 Nov.
const BEFORE_MIDNIGHT = new Date("2026-11-20T15:59:00.000Z");
const AFTER_MIDNIGHT = new Date("2026-11-20T16:01:00.000Z");

describe("calendarDaysBetween", () => {
  it("counts Singapore's calendar, not 24-hour blocks, across its midnight", () => {
    // Two minutes apart, one calendar day apart.
    expect(calendarDaysBetween(BEFORE_MIDNIGHT, AFTER_MIDNIGHT)).toBe(1);
    expect(calendarDaysBetween(BEFORE_MIDNIGHT, BEFORE_MIDNIGHT)).toBe(0);
  });

  it("is five days from 16 Nov 16:00 to 21 Nov 14:34, where whole 24-hour blocks say four", () => {
    const since = new Date("2026-11-16T08:00:00.000Z");
    const nowAt = new Date("2026-11-21T06:34:00.000Z");
    expect(calendarDaysBetween(since, nowAt)).toBe(5);
    expect(Math.floor((nowAt.getTime() - since.getTime()) / DAY)).toBe(4);
  });

  it("never goes below zero for a start that lies ahead", () => {
    expect(calendarDaysBetween(AFTER_MIDNIGHT, BEFORE_MIDNIGHT)).toBe(0);
  });
});

describe("waitParts", () => {
  it("counts minutes inside Singapore's day and hours after an hour of it", () => {
    const since = new Date("2026-11-20T01:00:00.000Z");
    expect(waitParts(since, new Date("2026-11-20T01:45:00.000Z"))).toEqual({
      unit: "minutes",
      amount: 45,
    });
    expect(waitParts(since, new Date("2026-11-20T04:00:00.000Z"))).toEqual({
      unit: "hours",
      amount: 3,
    });
  });

  it("changes from minutes to one day at Singapore's midnight, not after 24 hours", () => {
    expect(waitParts(BEFORE_MIDNIGHT, BEFORE_MIDNIGHT)).toEqual({
      unit: "minutes",
      amount: 0,
    });
    expect(waitParts(BEFORE_MIDNIGHT, AFTER_MIDNIGHT)).toEqual({
      unit: "days",
      amount: 1,
    });
  });
});
