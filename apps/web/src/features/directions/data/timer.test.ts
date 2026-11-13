import { describe, expect, it } from "vitest";
import { timerParts } from "./timer";

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
