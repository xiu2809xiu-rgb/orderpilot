import { describe, expect, it } from "vitest";
import { ValidationFailedError } from "../common/domain-error.js";
import { assertValidKey } from "./object-storage.js";

describe("assertValidKey", () => {
  it("accepts folder-style keys", () => {
    for (const key of [
      "documents/2026/11/0198f2a1.pdf",
      "a",
      "samples/PO 4100 (draft).pdf",
    ]) {
      expect(() => {
        assertValidKey(key);
      }, key).not.toThrow();
    }
  });

  it("refuses keys that climb out of their folder or hide a character", () => {
    for (const key of [
      "",
      "/absolute",
      "../secret",
      "a/../b",
      "a/./b",
      "a//b",
      "trailing/",
      "back\\slash",
      "line\nbreak",
      "nul\u0000byte",
      "x".repeat(1_025),
    ]) {
      expect(
        () => {
          assertValidKey(key);
        },
        JSON.stringify(key.slice(0, 20)),
      ).toThrow(ValidationFailedError);
    }
  });
});
