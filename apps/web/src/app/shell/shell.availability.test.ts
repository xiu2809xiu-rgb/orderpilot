import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// jsdom draws no layout, so the touch geometry of the availability button is
// read from the sheet as text. The end-to-end spec taps the avatar's centre in
// a real browser; this is the part of that check that needs no browser.
const css = readFileSync(path.join(import.meta.dirname, "shell.css"), "utf8");

/** The text of the at-rule block with this header that holds the given selector, braces matched. The sheet has several coarse-pointer blocks. */
function atRule(source: string, header: string, holding: string): string {
  let from = 0;
  for (;;) {
    const start = source.indexOf(header, from);
    expect(start, `${header} holding ${holding}`).toBeGreaterThanOrEqual(0);
    let depth = 0;
    let end = source.indexOf("{", start);
    for (; end < source.length; end += 1) {
      if (source[end] === "{") depth += 1;
      if (source[end] === "}") depth -= 1;
      if (depth === 0) break;
    }
    const block = source.slice(start, end + 1);
    if (block.includes(holding)) return block;
    from = end + 1;
  }
}

/** The declarations of the first rule with exactly this selector inside a block. */
function rule(block: string, selector: string): string {
  const start = block.indexOf(`\n  ${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return block.slice(block.indexOf("{", start) + 1, block.indexOf("}", start));
}

describe("the availability button's place in the side panel", () => {
  it("is centred on the avatar's corner for a mouse: 82 percent across and 18 percent down", () => {
    const base = /\.dx-person-dot\s*{([^}]*)}/.exec(css)?.[1] ?? "";
    expect(base).toContain("var(--av) * 0.82");
    expect(base).toContain("var(--av) * 0.18");
    expect(base).toContain("translate: -50% -50%");
  });

  it("leaves the avatar's centre to the account button for a finger: a 44 px box that starts 8 px inside the avatar's right edge", () => {
    const coarse = atRule(css, "@media (pointer: coarse)", ".dx-person-dot");
    const open = rule(coarse, ".dx-person-dot");
    // Left edge: the avatar's left, plus its width, minus 0.5 rem. A box
    // centred on the corner would cover 28 of the avatar's 32 px.
    expect(open).toContain(
      "inset-inline-start: calc(var(--dx-entry-pad) + var(--av) - 0.5rem)",
    );
    // Top edge: the row's top, so the box never reaches the Help row above.
    expect(open).toMatch(/\btop:\s*0;/);
    expect(open).toContain("translate: none");
  });

  it("draws a read-only dot in the 64 px rail for a finger, so the account button keeps its whole box", () => {
    const coarse = atRule(css, "@media (pointer: coarse)", ".dx-person-dot");
    const rail = rule(coarse, ".dx-rail .dx-person-dot");
    expect(rail).toContain("pointer-events: none");
  });
});
