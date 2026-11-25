import { ROLES, type Role } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { sessionFor } from "@/test/fixtures";
import { cuesFor, featuresFor, TILE_ORDER } from "./nav";
import { allFeatures } from "./registry";

describe("the feature registry", () => {
  it("lists each feature once, with its own path and namespace", () => {
    for (const key of ["id", "path", "namespace"] as const) {
      const values = allFeatures.map((feature) => feature[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("covers the web features named in the module ownership document", () => {
    expect(allFeatures.map((f) => f.id).sort()).toEqual(
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

describe("role home tiles", () => {
  const EXPECTED: Record<Role, readonly string[]> = {
    PRODUCT_MANAGER: ["myTasks", "waitingForApproval", "openOrders", "overdue"],
    // Open exceptions joined at ADR 0058 step 4, when the approver took
    // exceptions.read; a tile never lands on a refusal.
    APPROVER: ["awaitingApproval", "overdue", "openOrders", "openExceptions"],
    SUPPORT: [
      "myTasks",
      "documentsToConfirm",
      "openOrders",
      "overdue",
      "openExceptions",
    ],
    WAREHOUSE: ["myTasks", "readyToPick", "overdue", "openExceptions"],
    FINANCE: ["myTasks", "awaitingPayment", "overdue", "openExceptions"],
    LOGISTICS: ["myTasks", "readyToPick", "overdue", "openExceptions"],
    MANAGEMENT: [
      "openOrders",
      "overdue",
      "awaitingApproval",
      "awaitingPayment",
      "readyToPick",
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
      const open = featuresFor(session, allFeatures);
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
