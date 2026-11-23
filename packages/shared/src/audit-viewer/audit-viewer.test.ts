import { describe, expect, it } from "vitest";
import {
  auditEventQuerySchema,
  auditFilterOptionsSchema,
  isRefusalAction,
} from "./index.js";

describe("isRefusalAction", () => {
  it("knows the refusals the auth layer writes", () => {
    expect(isRefusalAction("auth.permission.refused")).toBe(true);
    expect(isRefusalAction("auth.refresh.reuse-detected")).toBe(true);
    expect(isRefusalAction("user.disabled")).toBe(false);
    expect(isRefusalAction("auth.refused.later")).toBe(false);
  });
});

describe("auditEventQuerySchema", () => {
  it("defaults the page and turns the refusals flag into a boolean", () => {
    const query = auditEventQuerySchema.parse({ refusalsOnly: "true" });
    expect(query).toMatchObject({ page: 1, pageSize: 25, refusalsOnly: true });
  });

  it("rejects a range that ends before it starts, and a non-flag", () => {
    const range = {
      from: "2026-02-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    };
    expect(auditEventQuerySchema.safeParse(range).success).toBe(false);
    expect(auditEventQuerySchema.safeParse({ refusalsOnly: "1" }).success).toBe(
      false,
    );
  });
});

describe("the events around a sequence (F-9)", () => {
  it("takes the sequence to centre the list on", () => {
    expect(auditEventQuerySchema.parse({ around: "1234" })).toMatchObject({
      around: 1234,
    });
  });

  it("rejects a sequence that is not a positive whole number", () => {
    for (const around of ["0", "-3", "1.5", "abc", ""]) {
      expect(auditEventQuerySchema.safeParse({ around }).success, around).toBe(
        false,
      );
    }
  });
});

describe("the people and actions the filters offer (F-9)", () => {
  const person = {
    id: "0194f3a0-0000-7000-8000-0000000000aa",
    name: "Farah Finance",
  };

  it("holds each person's id and name, and the action names", () => {
    expect(
      auditFilterOptionsSchema.parse({
        people: [person],
        actions: ["auth.permission.refused"],
      }),
    ).toEqual({ people: [person], actions: ["auth.permission.refused"] });
  });

  it("refuses a person with an email, or anything else beside the name", () => {
    for (const extra of [
      { email: "farah@example.test" },
      { role: "FINANCE" },
    ]) {
      expect(
        auditFilterOptionsSchema.safeParse({
          people: [{ ...person, ...extra }],
          actions: [],
        }).success,
        Object.keys(extra).join(),
      ).toBe(false);
    }
  });
});
