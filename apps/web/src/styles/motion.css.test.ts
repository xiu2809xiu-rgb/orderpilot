import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// What a unit test can say about the skeleton's shimmer without a layout: that
// the band moves by transform alone, at an even speed, from tokens, and that
// the reduced-motion rule removes it. What the browser computes under each
// setting is skeleton-shimmer.spec.ts, in apps/e2e.

const css = readFileSync(path.join(import.meta.dirname, "motion.css"), "utf8");

/** The text of one rule or at-rule: from its header to the brace that closes it. */
function block(header: string, from = 0): string {
  const start = css.indexOf(header, from);
  expect(start, `${header} is declared`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    if (css[i] === "}") depth -= 1;
    if (depth === 0) return css.slice(start, i + 1);
  }
  throw new Error(`${header} is never closed`);
}

describe("the skeleton shimmer in motion.css", () => {
  const band = block(".dx-shimmer::after {");

  it("sweeps with transform alone, never background-position", () => {
    const frames = block("@keyframes dx-shimmer");
    expect(frames).toContain("transform: translateX(-100%)");
    expect(frames).toContain("transform: translateX(100%)");
    expect(frames).not.toContain("background-position");
    expect(band).not.toContain("background-position");
    expect(band).not.toContain("background-size");
  });

  it("is linear, repeats, and sweeps in 1.4 to 1.8 seconds", () => {
    const animation =
      /animation:\s*dx-shimmer\s+([\d.]+)s\s+(\S+)\s+(\S+);/.exec(band);
    expect(animation, "the band has an animation").not.toBeNull();
    const [, seconds, timing, count] = animation ?? [];
    expect(Number(seconds)).toBeGreaterThanOrEqual(1.4);
    expect(Number(seconds)).toBeLessThanOrEqual(1.8);
    expect(timing).toBe("linear");
    expect(count).toBe("infinite");
  });

  it("takes its colour from a token, in light and dark, and has no hex colour", () => {
    expect(band).toContain("var(--foreground)");
    expect(band).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(band).not.toMatch(/\brgba?\(/);
  });

  it("is removed, not frozen, under reduced motion", () => {
    const reduced = block(
      "@media (prefers-reduced-motion: reduce) {",
      css.indexOf(".dx-shimmer::after"),
    );
    expect(reduced).toContain(".dx-shimmer::after");
    expect(reduced).toContain("display: none");
    expect(reduced).toContain("animation: none");
  });
});
