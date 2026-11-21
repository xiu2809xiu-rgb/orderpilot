import { describe, expect, it } from "vitest";
import { enterProps } from "./entrance";

describe("the arrival of a list", () => {
  it("staggers its entries in the first view and not after it", () => {
    expect(enterProps(3, true)).toEqual({
      className: "home-enter",
      style: { "--home-i": 3 },
    });
    expect(enterProps(30, true).style).toEqual({ "--home-i": 9 });
    expect(enterProps(3, false)).toEqual({});
  });
});
