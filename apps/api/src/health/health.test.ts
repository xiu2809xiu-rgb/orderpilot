import { describe, expect, it } from "vitest";
import { ReadinessReport } from "./domain/readiness-report.js";
import { ReadinessRegistry } from "./readiness-registry.js";

describe("ReadinessReport", () => {
  it("is ready when there are no checks", () => {
    const report = new ReadinessReport([]);
    expect(report.ready).toBe(true);
    expect(report.status).toBe("ok");
  });

  it("is unavailable when any check is down, and lists which", () => {
    const report = new ReadinessReport([
      { name: "redis", status: "up", durationMs: 1 },
      { name: "database", status: "down", durationMs: 2 },
    ]);
    expect(report.ready).toBe(false);
    expect(report.status).toBe("unavailable");
    expect(report.failing).toEqual(["database"]);
    expect(report.results.map((r) => r.name)).toEqual(["database", "redis"]);
  });
});

describe("ReadinessRegistry", () => {
  it("runs every check and reports each", async () => {
    const registry = new ReadinessRegistry();
    registry.register({ name: "a", check: () => Promise.resolve() });
    registry.register({
      name: "b",
      check: () => Promise.reject(new Error("no")),
    });
    const report = await registry.run();
    expect(report.results.map((r) => [r.name, r.status])).toEqual([
      ["a", "up"],
      ["b", "down"],
    ]);
  });

  it("counts a check that is too slow as down", async () => {
    const registry = new ReadinessRegistry();
    registry.register({
      name: "slow",
      check: () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
    });
    const report = await registry.run(20);
    expect(report.results[0]?.status).toBe("down");
  });

  it("refuses two checks with one name", () => {
    const registry = new ReadinessRegistry();
    registry.register({ name: "a", check: () => Promise.resolve() });
    expect(() => {
      registry.register({ name: "a", check: () => Promise.resolve() });
    }).toThrow(/exists already/);
  });
});
