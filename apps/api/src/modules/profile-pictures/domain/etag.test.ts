import { describe, expect, it } from "vitest";
import { etagMatches, etagOf } from "./etag.js";

const SHA = "a".repeat(64);

describe("the picture ETag", () => {
  it("is the SHA-256 in quotes", () => {
    expect(etagOf(SHA)).toBe(`"${SHA}"`);
  });

  it("matches the same tag, a weak form, a list and a star", () => {
    const tag = etagOf(SHA);
    expect(etagMatches(tag, tag)).toBe(true);
    expect(etagMatches(`W/${tag}`, tag)).toBe(true);
    expect(etagMatches(`"other", ${tag}`, tag)).toBe(true);
    expect(etagMatches("*", tag)).toBe(true);
  });

  it("does not match another tag, an unquoted one or no header", () => {
    const tag = etagOf(SHA);
    expect(etagMatches(`"${"b".repeat(64)}"`, tag)).toBe(false);
    expect(etagMatches(SHA, tag)).toBe(false);
    expect(etagMatches(undefined, tag)).toBe(false);
    expect(etagMatches("", tag)).toBe(false);
  });
});
