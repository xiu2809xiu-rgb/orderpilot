import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  confidenceBand,
  isUncertain,
} from "./confidence.js";

describe("confidence", () => {
  it("keeps the cut-offs the confidence badge has always used", () => {
    expect(CONFIDENCE_HIGH).toBe(0.9);
    expect(CONFIDENCE_MEDIUM).toBe(0.7);
  });

  it("puts a score in a band at the cut-offs", () => {
    expect(confidenceBand(0.9)).toBe("high");
    expect(confidenceBand(0.8999)).toBe("medium");
    expect(confidenceBand(0.7)).toBe("medium");
    expect(confidenceBand(0.6999)).toBe("low");
    expect(confidenceBand(0)).toBe("low");
    expect(confidenceBand(1)).toBe("high");
  });

  it("calls a field uncertain below the high band, so a person must confirm it", () => {
    expect(isUncertain(0.9)).toBe(false);
    expect(isUncertain(0.89)).toBe(true);
    expect(isUncertain(0.5)).toBe(true);
  });
});
