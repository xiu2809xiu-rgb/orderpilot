import { describe, expect, it } from "vitest";
import { DEFAULT_ROLE_PERMISSIONS } from "./permissions.js";
import {
  KPI_IDS,
  checkCompletedSchema,
  kpiSetSchema,
  trackerQuerySchema,
} from "./checks.js";
import { ROLES } from "./roles.js";

describe("area 3 contracts", () => {
  it("reports a check to area 2 as data, with no instruction in it", () => {
    const parsed = checkCompletedSchema.parse({
      event: "check.completed",
      orderNo: "SO-1",
      ruleId: "mock.sample",
      outcome: "fail",
      resultId: "r-1",
      evidence: [],
    });
    expect(Object.keys(parsed).sort()).toEqual([
      "event",
      "evidence",
      "orderNo",
      "outcome",
      "resultId",
      "ruleId",
    ]);
  });

  it("holds exactly Spectra's five measures", () => {
    expect(KPI_IDS).toHaveLength(5);
    const measures = KPI_IDS.map((id) => ({
      id,
      label: id,
      unit: "u",
      manual: 2,
      withOrderPilot: 1,
      lowerIsBetter: true,
      definition: "d",
    }));
    expect(
      kpiSetSchema.parse({ labEstimate: true, note: "n", measures }).measures,
    ).toHaveLength(5);
    expect(() =>
      kpiSetSchema.parse({ labEstimate: false, note: "n", measures }),
    ).toThrow();
  });

  it("pages the tracker from page 1 and refuses an unknown sort column", () => {
    expect(trackerQuerySchema.parse({}).page).toBe(1);
    expect(() => trackerQuerySchema.parse({ sort: "status" })).toThrow();
  });

  it("opens the area 3 permissions to some roles and keeps them off the admin", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.SUPPORT).toContain("exceptions.read");
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGEMENT).toContain("insights.read");
    expect(DEFAULT_ROLE_PERMISSIONS.SYSTEM_ADMIN).not.toContain("tracker.read");
    for (const role of ROLES) {
      expect(DEFAULT_ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});
