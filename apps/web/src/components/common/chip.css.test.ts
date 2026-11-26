import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrast,
  flatten,
  parseColor,
  surface,
  type Rgba,
  type Tokens,
} from "@/styles/contrast";
import { must } from "@/test/must";

// What a unit test can say about the chips' style sheet without a layout:
// that every duration and curve is a motion token, that the tokens are within
// 150 to 250 ms, that reduced motion stops each movement, and that the calm
// look of an unchosen chip still reads. How it looks and whether the bar
// jumps is judged in a browser.

const read = (...parts: string[]) =>
  readFileSync(path.join(import.meta.dirname, ...parts), "utf8");
const css = read("chip.css");
const tokens = read("..", "..", "styles", "tokens.css");
// Without comments, whose own colons would read as properties.
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** The declarations of the first block that starts exactly with this selector line. */
function declarations(selector: string): Map<string, string> {
  const start = bare.indexOf(`\n${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  // From the brace, so a selector's own colons (::before) are not a property.
  const open = start + selector.length + 3;
  const body = bare.slice(open, bare.indexOf("\n}", open));
  const out = new Map<string, string>();
  for (const m of body.matchAll(/([\w-]+):\s*([^;]+);/g)) {
    out.set(must(m[1]), must(m[2]).replace(/\s+/g, " ").trim());
  }
  return out;
}

/** The text of one at-rule, from its opening line to the line that closes it. */
function atRule(header: string): string {
  const start = css.indexOf(header);
  expect(start, `${header} is declared`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("\n}", start));
}

/** The first declaration of each custom property in tokens.css, which is the light one. */
const TOKENS = new Map<string, string>();
for (const m of tokens.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
  if (!TOKENS.has(must(m[1]))) TOKENS.set(must(m[1]), must(m[2]).trim());
}
const token = (name: string) => must(TOKENS.get(name));

const CHIP = ".dt-toggle,\n.od-toggle";

describe("the chips' motion", () => {
  it("takes its durations from tokens that are 150 to 250 ms", () => {
    for (const name of ["motion-fast", "motion-base", "motion-slow"]) {
      const ms = Number(/^(\d+)ms$/.exec(token(name))?.[1]);
      expect(ms, name).toBeGreaterThanOrEqual(150);
      expect(ms, name).toBeLessThanOrEqual(250);
    }
    expect(token("ease-out")).toMatch(/^cubic-bezier\(/);
  });

  it("writes no duration or curve of its own", () => {
    // A duration written as 0.2s or 200ms would slip past the tokens.
    expect(bare).not.toMatch(/\d(ms|s)\b/);
    expect(bare).not.toMatch(
      /cubic-bezier|ease-in|linear|steps\(|(?<![-\w])ease(?![-\w])/,
    );
  });

  it("eases the chip's fill, border and label over the fast token", () => {
    const transition = must(declarations(CHIP).get("transition"));
    for (const property of ["background-color", "border-color", "color"]) {
      expect(transition).toContain(
        `${property} var(--motion-fast) var(--ease-out)`,
      );
    }
  });

  it("opens the check's slot in width and opacity over a token", () => {
    const slot = declarations(".chip-slot");
    const transition = must(slot.get("transition"));
    expect(transition).toContain("width var(--motion-fast) var(--ease-out)");
    expect(transition).toContain("opacity var(--motion-fast) var(--ease-out)");
    // Closed it is a width of 0 and open a fixed one, so nothing else moves.
    expect(slot.get("width")).toBe("0");
    expect(declarations('.chip-slot[data-on="true"]').get("width")).toBe(
      "1.375rem",
    );
  });

  it("bumps the count and fades the pill with an animation of a token", () => {
    expect(
      must(declarations(".count-badge[data-bump]").get("animation")),
    ).toMatch(/^count-bump var\(--motion-fast\) var\(--ease-out\)$/);
    expect(must(declarations(".chip-leaving").get("animation"))).toMatch(
      /^chip-out var\(--motion-fast\) var\(--ease-out\) forwards$/,
    );
  });

  it("moves only opacity and scale on a pill, and never its height or layout", () => {
    const out = css.slice(css.indexOf("@keyframes chip-out"));
    const frames = out.slice(0, out.indexOf("\n}\n") + 3);
    expect(frames).toContain("opacity: 0");
    expect(frames).toContain("transform: scale(");
    expect(frames).not.toMatch(/height|margin|padding|width|max-/);
    const bump = css.slice(css.indexOf("@keyframes count-bump"));
    expect(bump.slice(0, bump.indexOf("\n}\n") + 3)).not.toMatch(
      /height|margin|padding|width/,
    );
  });

  it("stops every movement under reduced motion", () => {
    const reduced = atRule("@media (prefers-reduced-motion: reduce)");
    expect(reduced).toContain(".chip-slot");
    expect(reduced).toContain("transition: none");
    expect(reduced).toContain(".count-badge[data-bump]");
    expect(reduced).toContain(".chip-leaving");
    expect(reduced).toContain("animation: none");
  });

  it("draws the ghost's words from an attribute, so there is no second copy of the label", () => {
    expect(declarations(".chip-ghost-text::before").get("content")).toBe(
      "attr(data-label)",
    );
  });
});

describe("the calm look of a chip that is off", () => {
  it("has no fill, and keeps the control border and a muted label", () => {
    const chip = declarations(CHIP);
    expect(chip.get("background")).toBe("transparent");
    expect(chip.get("border")).toBe("1px solid var(--input)");
    expect(chip.get("color")).toBe("var(--muted-foreground)");
  });

  it("fills and takes the ring when it is on, so the check is not the only sign", () => {
    const on = declarations(
      '.dt-toggle[aria-checked="true"],\n.dt-toggle[aria-pressed="true"],\n.od-toggle[aria-pressed="true"]',
    );
    expect(on.get("border-color")).toBe("var(--ring)");
    expect(on.get("background")).toBe("var(--accent)");
  });

  it("grows to 44 px on a touch screen", () => {
    expect(atRule("@media (pointer: coarse)")).toContain("height: 2.75rem");
  });
});

/** The custom properties of one theme: the light ones, with the dark ones over them. */
function theme(scheme: "light" | "dark"): Tokens {
  const take = (selector: string): Tokens => {
    const start = tokens.indexOf(`\n${selector} {`);
    const body = tokens.slice(start, tokens.indexOf("\n}", start + 1));
    const out: Tokens = {};
    for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
      out[must(m[1])] = must(m[2]).replace(/\s+/g, " ").trim();
    }
    return out;
  };
  const light = take(":root");
  return scheme === "light" ? light : { ...light, ...take(".dark") };
}

describe.each(["light", "dark"] as const)(
  "the chip's colours in the %s scheme",
  (scheme) => {
    const t = theme(scheme);
    const colour = (name: string): Rgba => parseColor(must(t[name]));
    // The page and a panel: the two places a filter chip is drawn.
    const grounds = [surface(t, ["background"]), surface(t, ["panel-strong"])];

    it("keeps the label of a chip that is off at 4.5:1 and its border at 3:1, on the page and on a panel", () => {
      for (const ground of grounds) {
        expect(
          contrast(colour("muted-foreground"), ground),
        ).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colour("input"), ground)).toBeGreaterThanOrEqual(3);
      }
    });

    it("keeps a chip that is on at 4.5:1 for its label and 3:1 for its border", () => {
      for (const ground of grounds) {
        const fill = flatten(colour("accent"), ground);
        expect(
          contrast(flatten(colour("foreground"), fill), fill),
        ).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colour("ring"), ground)).toBeGreaterThanOrEqual(3);
      }
    });
  },
);
