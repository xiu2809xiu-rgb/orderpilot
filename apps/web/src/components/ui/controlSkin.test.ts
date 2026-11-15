import { describe, expect, it } from "vitest";
import { CONTROL_SKIN } from "./controlSkin";

describe("CONTROL_SKIN", () => {
  it("draws the read-only look for a text box only, never for a button or a select", () => {
    // Bare `read-only:` matches every non-editable element, so a Select
    // trigger (a button) was drawn dashed, as if it were locked.
    const readOnly = CONTROL_SKIN.split(" ").filter((c) =>
      c.includes("read-only"),
    );
    expect(readOnly.length).toBeGreaterThan(0);
    for (const c of readOnly) {
      expect(c, c).toMatch(/^\[&:is\(input,textarea\):read-only\]:/);
    }
  });
});
