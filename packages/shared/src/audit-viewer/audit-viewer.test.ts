import { describe, expect, it } from "vitest";
import { auditEventQuerySchema, isRefusalAction } from "./index.js";

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
