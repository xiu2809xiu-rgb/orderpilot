import { operationLogEntrySchema, type AuditEvent } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { actorUserIds, toOperationLogEntry } from "./operation-log-entry.js";

const PERSON = "6c1f5a5e-2c11-4e5b-9a43-0d7e8f6b1a21";

function event(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: "3f1c2a54-8b1e-4c52-9f0a-6d2f0b7a1e11",
    occurredAt: "2026-11-05T01:02:03.000Z",
    actor: { kind: "user", userId: PERSON, role: "SYSTEM_ADMIN" },
    action: "user.disabled",
    entityType: "User",
    entityId: "c2b0f1a8-7a6e-4c3d-8e2f-1b9a0d4c5e6f",
    summary: "Daniel Koh disabled Hafiz Rahman",
    changes: { disabled: { from: false, to: true }, sessionsRevoked: 2 },
    ip: "10.20.30.40",
    traceId: "trace-1",
    prevHash: "prev",
    hash: "hash",
    ...overrides,
  };
}

describe("a line of a record's operation log", () => {
  it("says who, when and what, and nothing else", () => {
    const entry = toOperationLogEntry(
      event(),
      new Map([[PERSON, "Daniel Koh"]]),
    );
    expect(entry).toEqual({
      id: "3f1c2a54-8b1e-4c52-9f0a-6d2f0b7a1e11",
      occurredAt: "2026-11-05T01:02:03.000Z",
      actorKind: "user",
      actorName: "Daniel Koh",
      actorRole: "SYSTEM_ADMIN",
      summary: "Daniel Koh disabled Hafiz Rahman",
    });
    const text = JSON.stringify(entry);
    expect(text).not.toContain("10.20.30.40");
    expect(text).not.toContain("sessionsRevoked");
    expect(text).not.toContain("trace-1");
    expect(operationLogEntrySchema.parse(entry)).toEqual(entry);
  });

  it("names the system part or the model that acted, with no role", () => {
    const seed = toOperationLogEntry(
      event({ actor: { kind: "system", name: "seed" } }),
      new Map(),
    );
    expect(seed).toMatchObject({
      actorKind: "system",
      actorName: "seed",
      actorRole: null,
    });
    const model = toOperationLogEntry(
      event({ actor: { kind: "ai", model: "mock-extractor-1" } }),
      new Map(),
    );
    expect(model.actorName).toBe("mock-extractor-1");
  });

  it("says Unknown user for a person whose name cannot be found", () => {
    expect(toOperationLogEntry(event(), new Map()).actorName).toBe(
      "Unknown user",
    );
  });

  it("asks for each person's name once", () => {
    const other = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
    expect(
      actorUserIds([
        event(),
        event(),
        event({ actor: { kind: "user", userId: other, role: "SUPPORT" } }),
        event({ actor: { kind: "system", name: "auth" } }),
      ]),
    ).toEqual([PERSON, other]);
  });
});
