import { describe, expect, it } from "vitest";
import { withQuery } from "./mutator";

describe("withQuery", () => {
  it("leaves a URL alone when there is nothing to add", () => {
    expect(withQuery("/api/v1/orders", undefined)).toBe("/api/v1/orders");
    expect(withQuery("/api/v1/orders", { page: undefined })).toBe(
      "/api/v1/orders",
    );
  });

  it("sends an array as repeated keys, not as JSON", () => {
    expect(
      withQuery("/api/v1/orders", { status: ["OPEN", "HELD"], page: 2 }),
    ).toBe("/api/v1/orders?status=OPEN&status=HELD&page=2");
  });

  it("encodes values", () => {
    expect(withQuery("/api/v1/orders", { search: "a&b" })).toBe(
      "/api/v1/orders?search=a%26b",
    );
  });
});
