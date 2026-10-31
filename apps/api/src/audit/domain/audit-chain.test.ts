import type { AuditEvent } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  hashEvent,
  verifyEvents,
  type AuditEventBody,
} from "./audit-chain.js";

function body(
  n: number,
  changes: AuditEventBody["changes"] = null,
): AuditEventBody {
  return {
    id: `00000000-0000-7000-8000-00000000000${String(n)}`,
    occurredAt: `2026-11-02T10:00:0${String(n)}.000Z`,
    actor: { kind: "system", name: "test" },
    action: "thing.happened",
    entityType: "Thing",
    entityId: String(n),
    summary: `Event ${String(n)}`,
    changes,
    ip: null,
    traceId: `trace-${String(n)}`,
  };
}

/** Links events the way the writer does. */
function chain(count: number): AuditEvent[] {
  const events: AuditEvent[] = [];
  let prevHash: string | null = null;
  for (let n = 1; n <= count; n++) {
    const hash: string = hashEvent(body(n), prevHash);
    events.push({ ...body(n), prevHash, hash });
    prevHash = hash;
  }
  return events;
}

function at(events: AuditEvent[], index: number): AuditEvent {
  const event = events[index];
  if (!event) throw new Error(`no event at ${String(index)}`);
  return event;
}

describe("canonicalJson", () => {
  it("sorts keys at every depth, so key order never changes a hash", () => {
    expect(
      canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: null } }),
    ).toBe('{"a":{"c":null,"d":[3,{"y":2,"z":1}]},"b":1}');
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
  });

  it("treats undefined like a missing key, and refuses numbers JSON cannot hold", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(() => canonicalJson({ a: Number.NaN })).toThrow(RangeError);
    expect(() => canonicalJson({ a: Infinity })).toThrow(RangeError);
  });
});

describe("hashEvent", () => {
  it("is stable, hex SHA-256, and covers the previous hash", () => {
    const first = hashEvent(body(1), null);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEvent(body(1), null)).toBe(first);
    expect(hashEvent(body(1), "abc")).not.toBe(first);
  });

  it("changes when any field changes, nested ones included", () => {
    const base = hashEvent(body(1, { a: { b: 1 } }), null);
    expect(hashEvent(body(1, { a: { b: 2 } }), null)).not.toBe(base);
    expect(
      hashEvent({ ...body(1, { a: { b: 1 } }), summary: "Other" }, null),
    ).not.toBe(base);
  });
});

describe("verifyEvents", () => {
  it("accepts an intact chain and an empty one", () => {
    expect(verifyEvents(chain(4))).toEqual({
      ok: true,
      checked: 4,
      brokenAt: null,
    });
    expect(verifyEvents([])).toEqual({ ok: true, checked: 0, brokenAt: null });
  });

  it("finds an event whose content was changed", () => {
    const events = chain(4);
    const victim = at(events, 2);
    events[2] = { ...victim, summary: "Rewritten" };
    const report = verifyEvents(events);
    expect(report.ok).toBe(false);
    expect(report.checked).toBe(2);
    expect(report.brokenAt).toEqual({
      id: victim.id,
      problem: "hash-mismatch",
    });
  });

  it("finds an event removed from the middle", () => {
    const events = chain(4);
    events.splice(1, 1);
    expect(verifyEvents(events).brokenAt).toMatchObject({
      problem: "prevHash-mismatch",
    });
  });

  it("finds events swapped, and a first event that claims a predecessor", () => {
    const events = chain(3);
    expect(verifyEvents([at(events, 1), at(events, 0), at(events, 2)]).ok).toBe(
      false,
    );
    expect(verifyEvents(events.slice(1)).brokenAt).toMatchObject({
      problem: "prevHash-mismatch",
    });
  });
});
