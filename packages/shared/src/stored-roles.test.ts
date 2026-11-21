import { describe, expect, it } from "vitest";
import {
  RETIRED_ROLES,
  ROLES,
  STORED_ROLES,
  auditActorSchema,
  auditEventSchema,
  storedAuditActorSchema,
  storedAuditEventSchema,
  storedRoleSchema,
} from "./index.js";

describe("stored roles (ADR 0058)", () => {
  it("holds every role as a stored role", () => {
    for (const role of ROLES) expect(STORED_ROLES).toContain(role);
  });

  it("holds every retired role as a stored role", () => {
    for (const role of RETIRED_ROLES) expect(STORED_ROLES).toContain(role);
  });

  it("retires exactly Management and the auditor", () => {
    expect(RETIRED_ROLES).toEqual(["MANAGEMENT", "AUDITOR"]);
  });

  it("holds nothing that is neither a role nor a retired role", () => {
    const known: readonly string[] = [...ROLES, ...RETIRED_ROLES];
    for (const role of STORED_ROLES) expect(known).toContain(role);
  });

  it("has no duplicate stored role", () => {
    expect(new Set(STORED_ROLES).size).toBe(STORED_ROLES.length);
  });

  it("parses each of the nine stored roles and refuses an unknown value", () => {
    expect(STORED_ROLES).toHaveLength(9);
    for (const role of STORED_ROLES) {
      expect(storedRoleSchema.parse(role)).toBe(role);
    }
    expect(storedRoleSchema.safeParse("CUSTOMER").success).toBe(false);
    expect(storedRoleSchema.safeParse("manager").success).toBe(false);
    expect(storedRoleSchema.safeParse(null).success).toBe(false);
  });
});

describe("stored audit actors and events", () => {
  const user = {
    kind: "user",
    userId: "3f1c2a54-8b1e-4c52-9f0a-6d2f0b7a1e11",
  } as const;

  it("reads an actor with any stored role", () => {
    for (const role of STORED_ROLES) {
      expect(storedAuditActorSchema.safeParse({ ...user, role }).success).toBe(
        true,
      );
    }
    expect(
      storedAuditActorSchema.safeParse({ ...user, role: "CUSTOMER" }).success,
    ).toBe(false);
  });

  it("reads an event whose actor has any stored role", () => {
    const event = {
      id: "3f1c2a54-8b1e-4c52-9f0a-6d2f0b7a1e12",
      occurredAt: "2026-11-21T00:00:00.000Z",
      actor: { ...user, role: "AUDITOR" },
      action: "order.read",
      entityType: "Order",
      entityId: "1",
      summary: "Read an order",
      changes: null,
      ip: null,
      traceId: "trace-1",
      prevHash: null,
      hash: "abc",
    };
    expect(storedAuditEventSchema.safeParse(event).success).toBe(true);
    expect(
      storedAuditEventSchema.safeParse({
        ...event,
        actor: { ...user, role: "CUSTOMER" },
      }).success,
    ).toBe(false);
  });

  it("keeps the writer's actor and event on the roles it accepts today", () => {
    for (const role of ROLES) {
      expect(auditActorSchema.safeParse({ ...user, role }).success).toBe(true);
    }
    expect(
      auditActorSchema.safeParse({ ...user, role: "CUSTOMER" }).success,
    ).toBe(false);
    expect(auditEventSchema.shape.actor).toBe(auditActorSchema);
    expect(storedAuditEventSchema.shape.actor).toBe(storedAuditActorSchema);
  });
});
