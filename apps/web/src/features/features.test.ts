import { ROLES, type Role } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { sessionFor } from "@/test/fixtures";
import { cuesFor, featuresFor, groupedFeatures, TILE_ORDER } from "./nav";
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
  const EXPECTED: Record<Role, readonly string[]> = {
    PRODUCT_MANAGER: ["myTasks", "awaitingApproval", "openOrders", "overdue"],
    // The story lists Open exceptions too, but the default matrix gives the
    // approver no exceptions.read, and a tile never lands on a refusal.
    APPROVER: ["awaitingApproval", "overdue", "openOrders"],
    SUPPORT: [
      "myTasks",
      "documentsToConfirm",
      "openOrders",
      "overdue",
      "openExceptions",
    ],
    WAREHOUSE: ["myTasks", "readyToShip", "overdue", "openExceptions"],
    FINANCE: ["myTasks", "awaitingPayment", "overdue", "openExceptions"],
    LOGISTICS: ["myTasks", "readyToShip", "overdue", "openExceptions"],
    MANAGEMENT: [
      "openOrders",
      "overdue",
      "awaitingApproval",
      "awaitingPayment",
      "readyToShip",
      "openExceptions",
    ],
    AUDITOR: ["auditEvents", "refusedActions", "roles", "openExceptions"],
    SYSTEM_ADMIN: ["activeUsers", "roles", "auditEvents", "aiUse"],
  };

  it.each(ROLES)("%s gets its tiles, in order", (role) => {
    const ids = cuesFor(sessionFor(role)).map((c) => c.cue.id);
    expect(ids).toEqual(EXPECTED[role]);
    expect(TILE_ORDER[role]).toEqual(
      expect.arrayContaining([...EXPECTED[role]]),
    );
  });

  it.each(ROLES)(
    "%s gets no tile that opens a page it may not read",
    (role) => {
      const session = sessionFor(role);
      const open = featuresFor(session);
      for (const { cue } of cuesFor(session)) {
        const segment = cue.to.split(/[/?]/)[1];
        const page = open.find((f) => f.path === segment);
        expect(page, `${role} ${cue.id} opens ${cue.to}`).toBeDefined();
        if (cue.permission) {
          expect(session.permissions).toContain(cue.permission);
        }
      }
    },
  );

  it("drops a tile when the session lacks the list's permission", () => {
    const session = sessionFor("MANAGEMENT");
    const narrowed = {
      ...session,
      permissions: session.permissions.filter(
        (p) => p !== "workflows.inboxes.any",
      ),
    };
    const ids = cuesFor(narrowed).map((c) => c.cue.id);
    expect(ids).not.toContain("awaitingApproval");
    expect(cuesFor(null)).toEqual([]);
  });
});
