import { describe, expect, it } from "vitest";
import { assertNotSelf, assertNotSelfForReset, isSelf } from "./user-rules.js";

const ME = "00000000-0000-7000-8000-00000000000a";
const OTHER = "00000000-0000-7000-8000-00000000000b";

describe("user rules", () => {
  it("knows when a person acts on their own account", () => {
    expect(isSelf(ME, ME)).toBe(true);
    expect(isSelf(ME, OTHER)).toBe(false);
  });

  it("refuses a reset of oneself", () => {
    expect(() => {
      assertNotSelfForReset(ME, ME);
    }).toThrow("You cannot reset your own two-step verification.");
    expect(() => {
      assertNotSelfForReset(ME, OTHER);
    }).not.toThrow();
  });

  it("keeps the words of each refusal about its own action", () => {
    expect(() => {
      assertNotSelf(ME, ME);
    }).toThrow("You cannot disable your own account.");
  });
});
