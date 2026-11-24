import { describe, expect, it } from "vitest";
import {
  AvailabilityRules,
  CLOCK_SKEW_MINUTES,
  type StoredAvailability,
} from "./availability-rules.js";

/** One fixed moment, years from real time, so a rule that reads the clock fails. */
const NOW = new Date("2031-03-01T09:00:00.000Z");
const HOUR = 3_600_000;
const MINUTE = 60_000;
const AVAILABLE_DEFAULT = { value: "AVAILABLE", setAt: null, expiresAt: null };

function setAt(offsetMs: number): StoredAvailability {
  return {
    state: "DO_NOT_DISTURB",
    setAt: new Date(NOW.getTime() + offsetMs),
  };
}

describe("the 12-hour rule", () => {
  const rules = new AvailabilityRules();

  it("gives Available and null times for no row", () => {
    expect(rules.effective(null, NOW)).toEqual(AVAILABLE_DEFAULT);
  });

  it("keeps a row live at 11 h 59 min 59.999 s", () => {
    const row = setAt(-(12 * HOUR - 1));
    expect(rules.effective(row, NOW).value).toBe("DO_NOT_DISTURB");
  });

  it("ends a row at exactly 12 h 00 min 00.000 s and after it", () => {
    expect(rules.effective(setAt(-12 * HOUR), NOW)).toEqual(AVAILABLE_DEFAULT);
    expect(rules.effective(setAt(-12 * HOUR - 1), NOW)).toEqual(
      AVAILABLE_DEFAULT,
    );
    expect(rules.effective(setAt(-13 * HOUR), NOW)).toEqual(AVAILABLE_DEFAULT);
  });

  it("gives expiresAt as setAt plus 12 hours", () => {
    const row = setAt(-2 * HOUR);
    const shown = rules.effective(row, NOW);
    expect(shown.setAt).toEqual(row.setAt);
    expect(shown.expiresAt).toEqual(new Date(row.setAt.getTime() + 12 * HOUR));
  });

  it("shows both stored states as they are", () => {
    for (const state of ["FOCUSING", "DO_NOT_DISTURB"] as const) {
      const row = { state, setAt: NOW };
      expect(rules.effective(row, NOW).value).toBe(state);
    }
  });

  it("keeps a row stamped 5 minutes ahead of now live, with expiresAt not capped", () => {
    const ahead = CLOCK_SKEW_MINUTES * MINUTE;
    const row = setAt(ahead);
    const shown = rules.effective(row, NOW);
    expect(shown.value).toBe("DO_NOT_DISTURB");
    expect(shown.expiresAt).toEqual(new Date(row.setAt.getTime() + 12 * HOUR));
    expect(shown.expiresAt?.getTime()).toBeGreaterThan(
      NOW.getTime() + 12 * HOUR,
    );
  });

  it("gives Available for a row stamped 5 minutes and 1 ms ahead of now", () => {
    const row = setAt(CLOCK_SKEW_MINUTES * MINUTE + 1);
    expect(rules.effective(row, NOW)).toEqual(AVAILABLE_DEFAULT);
  });

  it("gives the cutoff as now minus 12 hours and the latest as now plus 5 minutes", () => {
    expect(rules.cutoff(NOW)).toEqual(new Date(NOW.getTime() - 12 * HOUR));
    expect(rules.latest(NOW)).toEqual(new Date(NOW.getTime() + 5 * MINUTE));
  });

  it("has a cutoff that agrees with what is shown", () => {
    const cutoff = rules.cutoff(NOW);
    const atCutoff = { state: "FOCUSING", setAt: cutoff } as const;
    const justAfter = {
      state: "FOCUSING",
      setAt: new Date(cutoff.getTime() + 1),
    } as const;
    expect(rules.effective(atCutoff, NOW).value).toBe("AVAILABLE");
    expect(rules.effective(justAfter, NOW).value).toBe("FOCUSING");
  });
});
