import type { SparkSource } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { SparkRun } from "./spark-run.js";

const order = (id: string): SparkSource => ({
  kind: "order",
  id,
  label: `Order ${id}`,
});
const OURS = ["check_stock", "find_orders", "get_order"];

describe("the run of one question", () => {
  it("keeps each record once, in the order it was first looked at", () => {
    const run = new SparkRun();
    run.addSources([order("SO-1"), order("SO-2")]);
    run.addSources([order("SO-1"), { kind: "item", id: "SO-1", label: "x" }]);
    expect(run.sources.map((s) => `${s.kind} ${s.id}`)).toEqual([
      "order SO-1",
      "order SO-2",
      "item SO-1",
    ]);
  });

  it("stops at twenty sources and forty steps", () => {
    const run = new SparkRun();
    run.addSources(
      Array.from({ length: 50 }, (_, i) => order(`SO-${String(i)}`)),
    );
    for (let i = 0; i < 60; i += 1) {
      run.noteStep({ tool: "get_order", status: "ran" });
    }
    expect(run.sources).toHaveLength(20);
    expect(run.steps).toHaveLength(40);
  });

  describe("a refused tool", () => {
    const refusalAfter = (steps: Parameters<SparkRun["noteStep"]>[0][]) => {
      const run = new SparkRun();
      for (const step of steps) run.noteStep(step);
      return run.hasUnresolvedRefusal(OURS);
    };

    it("is unresolved when the tool never ran afterwards, as with a role that may not use it", () => {
      expect(refusalAfter([{ tool: "check_stock", status: "refused" }])).toBe(
        true,
      );
    });

    it("is resolved when the model got round it and the tool ran", () => {
      expect(
        refusalAfter([
          { tool: "get_order", status: "refused" },
          { tool: "get_order", status: "ran" },
        ]),
      ).toBe(false);
    });

    it("is not resolved by a run that came BEFORE the refusal", () => {
      expect(
        refusalAfter([
          { tool: "get_order", status: "ran" },
          { tool: "get_order", status: "refused" },
        ]),
      ).toBe(true);
    });

    it("is not resolved by another tool running", () => {
      expect(
        refusalAfter([
          { tool: "get_order", status: "refused" },
          { tool: "find_orders", status: "ran" },
        ]),
      ).toBe(true);
    });

    it("does not count a name the model made up", () => {
      expect(refusalAfter([{ tool: "approve_order", status: "refused" }])).toBe(
        false,
      );
    });

    it("does not count a tool that ran or failed", () => {
      expect(
        refusalAfter([
          { tool: "get_order", status: "ran" },
          { tool: "find_orders", status: "failed" },
        ]),
      ).toBe(false);
    });
  });
});
