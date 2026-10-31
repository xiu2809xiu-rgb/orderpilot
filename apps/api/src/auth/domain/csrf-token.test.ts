import { describe, expect, it } from "vitest";
import { CsrfTokens } from "./csrf-token.js";

const csrf = new CsrfTokens("unit-test-secret-unit-test-secret-1234");

describe("CsrfTokens", () => {
  it("accepts a token it issued when cookie and header match", () => {
    const token = csrf.issue();
    expect(csrf.verify(token, token)).toBe(true);
  });

  it("issues a different token each time", () => {
    expect(csrf.issue()).not.toBe(csrf.issue());
  });

  it("refuses a missing, mismatched or unsigned pair", () => {
    const token = csrf.issue();
    expect(csrf.verify(undefined, token)).toBe(false);
    expect(csrf.verify(token, undefined)).toBe(false);
    expect(csrf.verify(token, csrf.issue())).toBe(false);
    expect(csrf.verify("a.b", "a.b")).toBe(false);
    expect(csrf.verify("plain", "plain")).toBe(false);
    expect(csrf.verify("", "")).toBe(false);
  });

  it("refuses a token signed under another secret", () => {
    const foreign = new CsrfTokens(
      "another-secret-another-secret-123456",
    ).issue();
    expect(csrf.verify(foreign, foreign)).toBe(false);
  });
});
