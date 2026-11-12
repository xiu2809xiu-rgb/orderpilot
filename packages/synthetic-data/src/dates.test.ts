import { describe, expect, it } from "vitest";
import { addMonths, dateInMonth, historyMonths, monthOf } from "./dates.js";

describe("month helpers", () => {
  it("reads the month of a date", () => {
    expect(monthOf("2026-11-02")).toBe("2026-11");
  });

  it("adds months across the end of a year, both ways", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 12)).toBe("2027-12");
    expect(addMonths("2026-03", -24)).toBe("2024-03");
  });

  it("lists whole months ending before the reference month", () => {
    const months = historyMonths("2026-11-02");
    expect(months).toHaveLength(24);
    expect(months[0]).toBe("2024-11");
    expect(months[23]).toBe("2026-10");
    expect(historyMonths("2026-01-31")[23]).toBe("2025-12");
  });

  it("moves the window by one month when the reference crosses a month", () => {
    expect(historyMonths("2026-12-02")[23]).toBe("2026-11");
    expect(historyMonths("2026-11-23")[23]).toBe("2026-10");
  });

  it("holds a day to the last day of its month", () => {
    expect(dateInMonth("2026-02", 30)).toBe("2026-02-28");
    expect(dateInMonth("2028-02", 30)).toBe("2028-02-29");
    expect(dateInMonth("2026-12", 31)).toBe("2026-12-31");
    expect(dateInMonth("2026-04", 0)).toBe("2026-04-01");
  });
});
