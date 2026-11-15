import { describe, expect, it } from "vitest";
import { REACH } from "./TrendSection";

describe("TrendSection", () => {
  it("gives the block's link a 44 px box on a coarse pointer", () => {
    expect(REACH).toContain("[&_a]:pointer-coarse:min-h-11");
  });
});
