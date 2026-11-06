import { describe, expect, it } from "vitest";
import {
  OPERATION_LOG_ENTITIES,
  OPERATION_LOG_READERS,
  operationLogEntrySchema,
  operationLogParamsSchema,
  operationLogReader,
} from "./operation-log.js";
import { PERMISSIONS } from "./permissions.js";

describe("who may read a record's operation log", () => {
  it("names a real permission for every kind of record", () => {
    for (const permission of Object.values(OPERATION_LOG_READERS)) {
      expect(PERMISSIONS).toContain(permission);
    }
    expect(OPERATION_LOG_ENTITIES).toEqual(Object.keys(OPERATION_LOG_READERS));
  });

  it("reads a user's log with users.read and an order's with orders.read", () => {
    expect(operationLogReader("User")).toBe("users.read");
    expect(operationLogReader("Order")).toBe("orders.read");
  });

  it("names no permission for a kind with no log, or a name from the prototype chain", () => {
    for (const kind of [
      "ApiRoute",
      "RolePermission",
      "toString",
      "",
      undefined,
    ]) {
      expect(operationLogReader(kind)).toBeUndefined();
    }
  });

  it("refuses an unknown kind, an empty id and an id that is too long", () => {
    expect(
      operationLogParamsSchema.safeParse({
        entityType: "ApiRoute",
        entityId: "x",
      }).success,
    ).toBe(false);
    expect(
      operationLogParamsSchema.safeParse({ entityType: "User", entityId: "  " })
        .success,
    ).toBe(false);
    expect(
      operationLogParamsSchema.safeParse({
        entityType: "User",
        entityId: "x".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("drops any field value, IP address or hash from an entry", () => {
    const parsed = operationLogEntrySchema.parse({
      id: "3f1c2a54-8b1e-4c52-9f0a-6d2f0b7a1e11",
      occurredAt: "2026-11-05T01:02:03.000Z",
      actorKind: "user",
      actorName: "Mei Tan",
      actorRole: "SUPPORT",
      summary: "Mei Tan disabled Hafiz Rahman",
      ip: "10.1.2.3",
      changes: { reason: "left the company" },
      hash: "abc",
    });
    expect(Object.keys(parsed).sort()).toEqual([
      "actorKind",
      "actorName",
      "actorRole",
      "id",
      "occurredAt",
      "summary",
    ]);
  });
});
