import { describe, expect, it } from "vitest";
import { declaredOrigin, originOfSetting } from "./spark-origin.js";

describe("the origin Spark declares to the destination check", () => {
  it("is synthetic only for the exact word synthetic", () => {
    expect(originOfSetting("synthetic")).toBe("synthetic");
  });

  it("is real for the word real", () => {
    expect(originOfSetting("real")).toBe("real");
  });

  it("fails closed: anything it cannot read as synthetic is real", () => {
    for (const setting of [
      undefined,
      null,
      "",
      "Synthetic",
      " synthetic",
      "synthetic ",
      "demo",
      "fake",
      0,
      false,
      {},
      ["synthetic"],
    ]) {
      expect(originOfSetting(setting), JSON.stringify(setting)).toBe("real");
    }
  });

  it("is real when reading the setting throws", () => {
    expect(
      declaredOrigin(() => {
        throw new Error("the config is gone");
      }),
    ).toBe("real");
  });

  it("is synthetic when the setting reads as synthetic", () => {
    expect(declaredOrigin(() => "synthetic")).toBe("synthetic");
  });
});
