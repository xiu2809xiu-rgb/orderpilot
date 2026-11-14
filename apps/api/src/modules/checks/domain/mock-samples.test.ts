import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import { mockMatches, mockOverdue, mockTimeline } from "./mock-samples.js";

const dataset = createSyntheticDataset();
const endOfToday = Date.parse(`${dataset.asOf}T15:59:59Z`);

describe("the sample order page", () => {
  it("puts every step on or before today, in order", () => {
    for (const order of dataset.orders) {
      const times = mockTimeline(order, dataset.asOf).map((step) =>
        Date.parse(step.at),
      );
      for (const [index, at] of times.entries()) {
        expect(at, order.header.no).toBeLessThanOrEqual(endOfToday);
        if (index > 0) {
          expect(at, order.header.no).toBeGreaterThan(times[index - 1] ?? 0);
        }
      }
    }
  });

  // Every shipped order passed the packing list check, so it must not say a quantity differs.
  it("says a quantity differs only while the packing list check is the current step", () => {
    for (const order of dataset.orders) {
      for (const step of mockTimeline(order, dataset.asOf)) {
        if (step.effect.startsWith("A quantity differs")) {
          expect(step.current, order.header.no).toBe(true);
        }
      }
    }
  });

  it("writes the date in an overdue reason in words", () => {
    const reasons = dataset.orders
      .map((order) => mockOverdue(order, dataset.asOf).reason)
      .filter((reason): reason is string => reason !== null);
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).toMatch(/was due on \d{1,2} [A-Z][a-z]{2} \d{4}$/);
    }
  });

  it("offers as a possible match only a record whose name starts with the same word", () => {
    const first = (name: string) => name.split(/\s+/)[0]?.toLowerCase();
    for (const order of dataset.orders) {
      for (const match of mockMatches(
        order,
        dataset.customers,
        dataset.items,
      )) {
        for (const possible of match.possibleMatches) {
          expect(possible.no).not.toBe(match.matchedNo);
          expect(first(possible.name)).toBe(first(match.matchedName ?? ""));
        }
      }
    }
  });
});
