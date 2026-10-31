import { ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { sessionFor } from "@/test/fixtures";
import { cuesFor, featuresFor, groupedFeatures } from "./nav";
import { features } from "./registry";

describe("the feature registry", () => {
  it("lists each feature once, with its own path and namespace", () => {
    for (const key of ["id", "path", "namespace"] as const) {
      const values = features.map((feature) => feature[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("covers the web features named in the module ownership document", () => {
    expect(features.map((f) => f.id).sort()).toEqual(
      [
        "audit",
        "connectors",
        "constellation",
        "documents",
        "exceptions",
        "governance",
        "insights",
        "mapping",
        "master-data",
        "monitoring",
        "order-tracker",
        "orders",
        "workflows",
      ].sort(),
    );
  });
});

describe("menus by role", () => {
  it("shows only the areas a role's permissions open", () => {
    const admin = featuresFor(sessionFor("SYSTEM_ADMIN")).map((f) => f.id);
    expect(admin).toContain("governance");
    expect(admin).toContain("audit");
    expect(admin).not.toContain("orders");

    const warehouse = featuresFor(sessionFor("WAREHOUSE")).map((f) => f.id);
    expect(warehouse).toContain("orders");
    expect(warehouse).not.toContain("governance");
    expect(warehouse).not.toContain("audit");
  });

  it("shows nothing without a session", () => {
    expect(featuresFor(null)).toEqual([]);
  });

  it("groups the menu in a fixed order and drops empty groups", () => {
    const groups = groupedFeatures(featuresFor(sessionFor("SYSTEM_ADMIN")));
    expect(groups.map((g) => g.group)).toEqual(["data", "control"]);
  });
});

describe("role home tiles", () => {
  it.each(ROLES)("%s has at least one tile it may open", (role) => {
    const session = sessionFor(role);
    expect(cuesFor(role, featuresFor(session)).length).toBeGreaterThan(0);
  });

  it("gives approvers the SPR tile and warehouse staff the ship tile", () => {
    const ids = (role: (typeof ROLES)[number]) =>
      cuesFor(role, featuresFor(sessionFor(role))).map(
        (c) => `${c.feature.id}.${c.cue.id}`,
      );
    expect(ids("APPROVER")).toContain("workflows.sprApproval");
    expect(ids("WAREHOUSE")).toContain("orders.readyToShip");
    expect(ids("WAREHOUSE")).not.toContain("workflows.sprApproval");
  });
});
