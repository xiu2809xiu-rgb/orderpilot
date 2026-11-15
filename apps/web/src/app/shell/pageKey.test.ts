import { describe, expect, it } from "vitest";
import { pageKey } from "./pageKey";

describe("pageKey", () => {
  it("tells one path from another", () => {
    expect(pageKey("/orders")).not.toBe(pageKey("/orders/SO-0110"));
  });

  it("ignores a trailing slash and keeps the root", () => {
    expect(pageKey("/orders/")).toBe("/orders");
    expect(pageKey("/orders//")).toBe("/orders");
    expect(pageKey("/")).toBe("/");
    expect(pageKey("")).toBe("/");
  });
});
