import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { must } from "@/test/must";

// What a unit test can say about the edge marks' style sheet without a
// layout: that they take no click, which frame is above which, and that the
// reduced-motion, forced-colours and print cases exist. Where the marks are
// drawn is scroll-edges.spec.ts, in a browser.

const css = readFileSync(
  path.join(import.meta.dirname, "ScrollRegion.css"),
  "utf8",
);

/** The declarations of the first block that starts with this selector, top level or not. */
function declarations(selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  const body = css.slice(start + selector.length + 2, css.indexOf("}", start));
  const out = new Map<string, string>();
  for (const m of body.matchAll(/([\w-]+):\s*([^;]+);/g)) {
    out.set(must(m[1]), must(m[2]).trim());
  }
  return out;
}

/** The text of one at-rule, from its opening line to the line that closes it. */
function atRule(header: string): string {
  const start = css.indexOf(header);
  expect(start, `${header} is declared`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("\n}", start));
}

describe("the edge marks' style sheet", () => {
  it("takes no click on the rail or on either frame", () => {
    expect(declarations(".sr-edges").get("pointer-events")).toBe("none");
    expect(declarations(".sr-edge").get("pointer-events")).toBe("none");
  });

  it("takes no room: the rail is absolute and collapsed until it is measured", () => {
    const rail = declarations(".sr-edges");
    expect(rail.get("position")).toBe("absolute");
    expect(rail.get("width")).toBe("0");
    expect(rail.get("height")).toBe("0");
  });

  it("pins each frame over the visible box with sticky, so no scroll handler moves it", () => {
    const frame = declarations(".sr-edge");
    expect(frame.get("position")).toBe("sticky");
    // Back by the scroll box's padding, or a padded box (the order peek)
    // would draw the marks that far inside its visible edge.
    expect(frame.get("top")).toContain("--sr-pad-top");
    expect(frame.get("left")).toContain("--sr-pad-left");
    expect(frame.get("width")).toContain("--sr-client-w");
    expect(frame.get("height")).toContain("--sr-client-h");
  });

  it("makes the mark a band wide enough to see, 2rem or more", () => {
    // At 1rem the light mark was about 8 px of visible shadow: too faint to
    // notice. The colour is held by the contrast test, so width is the lever.
    const mark = /--sr-mark:\s*([\d.]+)rem;/.exec(css);
    expect(Number(must(mark)[1])).toBeGreaterThanOrEqual(2);
  });

  it("puts the left mark under the pinned columns and the right mark over a pinned row menu", () => {
    // Pinned columns are z-1 in a data table and z-10 in the access matrix, a
    // pinned row menu is z-1 and heading cells are z-10 and z-20.
    const start = Number(declarations(".sr-edge-start").get("z-index"));
    const end = Number(declarations(".sr-edge-end").get("z-index"));
    expect(start).toBeLessThan(1);
    expect(end).toBeGreaterThan(1);
    expect(end).toBeLessThan(10);
  });

  it("is invisible until the region says that side has more", () => {
    expect(declarations(".sr-edge").get("opacity")).toBe("0");
    expect(css).toContain(
      ".sr-region[data-more-start] > .sr-edges > .sr-edge-start",
    );
    expect(css).toContain(
      ".sr-region[data-more-end] > .sr-edges > .sr-edge-end",
    );
  });

  it("fades over the fast motion token, and not at all under reduced motion", () => {
    expect(declarations(".sr-edge").get("transition")).toBe(
      "opacity var(--motion-fast) var(--ease-out)",
    );
    expect(atRule("@media (prefers-reduced-motion: reduce)")).toContain(
      "transition: none",
    );
  });

  it("is a plain line in the system text colour in forced colours", () => {
    const forced = atRule("@media (forced-colors: active)");
    expect(forced).toContain("background-image: none");
    expect(forced).toContain("border-left: 1px solid CanvasText");
    expect(forced).toContain("border-right: 1px solid CanvasText");
  });

  it("is not shown in print", () => {
    expect(atRule("@media print")).toContain("display: none");
  });
});
