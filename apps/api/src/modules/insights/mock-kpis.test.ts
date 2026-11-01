import { kpiSetSchema } from "@orderpilot/shared";
import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import { mockKpiSet } from "./mock-kpis.js";

describe("the mock KPI set", () => {
  const dataset = createSyntheticDataset();
  const set = mockKpiSet(dataset);

  it("parses against the contract and keeps the five measures", () => {
    expect(kpiSetSchema.safeParse(set).success).toBe(true);
    expect(set.measures.map((m) => m.id)).toEqual(
      dataset.kpis.map((k) => k.id),
    );
  });

  it("carries twelve weekly values and a target for each, ending on the dataset's latest week", () => {
    for (const measure of set.measures) {
      expect(measure.weekly).toHaveLength(12);
      expect(measure.target).toBeGreaterThan(0);
      expect(measure.weekly?.at(-1)?.value).toBe(measure.withOrderPilot);
    }
  });

  it("agrees with the orders: overdue orders is the number of orders with late work", () => {
    const overdue = dataset.orders.filter(
      (o) => o.step.dueOn !== null && o.step.dueOn < dataset.asOf,
    ).length;
    expect(
      set.measures.find((m) => m.id === "overdueOrders")?.withOrderPilot,
    ).toBe(overdue);
  });
});
