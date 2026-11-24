import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrast,
  flatten,
  parseColor,
  surface,
  type Tokens,
} from "@/styles/contrast";
import { must } from "@/test/must";
import {
  CODE_FIELD_HEIGHT_PX,
  CODE_FIELD_PILL,
  CODE_LENGTH,
} from "./codeFieldMotion";

const here = import.meta.dirname;
const read = (file: string) => readFileSync(path.join(here, file), "utf8");
const css = read("codeField.css");
const tokensCss = read("../../../styles/tokens.css");
const controlsCss = read("../../ui/controls.css");

/** The custom properties declared in one selector's block. */
function block(source: string, selector: string): Tokens {
  const start = source.indexOf(`\n${selector} {`);
  expect(start, `${selector} is declared`).toBeGreaterThanOrEqual(0);
  const body = source.slice(start, source.indexOf("\n}", start + 1));
  const out: Tokens = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) {
    out[must(m[1])] = must(m[2]).replace(/\s+/g, " ").trim();
  }
  return out;
}

const light: Tokens = {
  ...block(tokensCss, ":root"),
  ...block(controlsCss, ":root"),
};
const dark: Tokens = {
  ...light,
  ...block(tokensCss, ".dark"),
  ...block(controlsCss, ".dark"),
};

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("the code field's colours in the %s scheme", (_scheme, t) => {
  const colour = (name: string) => parseColor(must(t[name]));
  const card = surface(t, ["card"]);
  // A cell is the control's own fill over the card, over the worst ground.
  const cell = flatten(colour("control-bg"), card);

  it("keeps the digits, the hint and the pill words at 4.5:1 on what they sit on", () => {
    const found: [string, number][] = [
      ["foreground on a cell", contrast(colour("foreground"), cell)],
      [
        "the Verifying word on its pill",
        contrast(colour("muted-foreground"), cell),
      ],
      [
        "the red digits on a red cell",
        contrast(
          colour("destructive"),
          flatten(colour("destructive-surface"), card),
        ),
      ],
      [
        "the Verified word on the green pill",
        contrast(colour("success"), flatten(colour("success-surface"), card)),
      ],
      ["the hint under the field", contrast(colour("faint-foreground"), card)],
    ];
    for (const [what, ratio] of found) {
      expect(ratio, what).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps each cell's edge, the focus ring and the state edges at 3:1 against the card", () => {
    for (const name of ["input", "ring", "destructive", "success"]) {
      expect(
        contrast(colour(name), card),
        `--${name} on the card`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the focus ring at 3:1 against the cell it sits on", () => {
    expect(contrast(colour("ring"), cell)).toBeGreaterThanOrEqual(3);
  });
});

/** The declarations of one rule, found by its exact selector at the start of a line. */
function ruleBody(selector: string): string {
  const start = css.indexOf(`
${selector} {`);
  expect(start, `${selector} is a rule`).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf("{", start), css.indexOf("}", start));
}

describe("the sheet draws the pairs that are measured above", () => {
  it("paints cells, digits, edges and the ring with the tokens the contrast test uses", () => {
    const base = ruleBody(".cf");
    expect(base).toContain("--cf-cell-bg: var(--control-bg)");
    expect(base).toContain("--cf-edge: var(--input)");
    expect(base).toContain("--cf-ink: var(--foreground)");
    expect(ruleBody(".cf-ring")).toContain("border: 2px solid var(--ring)");
  });

  it("paints the Verifying word, the red cells and the green pill with theirs", () => {
    expect(ruleBody(".cf-verifying")).toContain(
      "color: var(--muted-foreground)",
    );
    expect(ruleBody(".cf-success")).toContain("color: var(--success)");
    const wrong = ruleBody('.cf[data-state="error"] .cf-cell');
    expect(wrong).toContain("--cf-ink: var(--destructive)");
    expect(wrong).toContain("--cf-cell-bg: var(--destructive-surface)");
    expect(wrong).toContain("--cf-edge: var(--destructive)");
    const right = ruleBody('.cf[data-state="success"] .cf-shell');
    expect(right).toContain("border-color: var(--success)");
    expect(right).toContain("background-color: var(--success-surface)");
  });
});

/** A clamp(min, preferred vw, max) in px for a viewport width. */
function gapAt(viewport: number): number {
  const match =
    /--cf-gap:\s*clamp\((\d+)px,\s*(\d+(?:\.\d+)?)vw,\s*(\d+)px\)/.exec(css);
  const [, low, vw, high] = must(match);
  return Math.min(
    Number(high),
    Math.max(Number(low), (viewport * Number(vw)) / 100),
  );
}

/** One cell's width, with the shell's 1 px frame taken off both sides. */
function cellWidth(container: number, viewport: number): number {
  return (container - 2 - (CODE_LENGTH - 1) * gapAt(viewport)) / CODE_LENGTH;
}

describe("the code field's size", () => {
  it("is 56 px high, one touch target over the 44 px a finger needs", () => {
    const match = /--cf-h:\s*([\d.]+)rem/.exec(css);
    const px = Number(must(match?.[1])) * 16;
    expect(px).toBe(CODE_FIELD_HEIGHT_PX);
    expect(px).toBeGreaterThanOrEqual(44);
  });

  it("makes the real input cover the whole shell, so the whole field is the target", () => {
    const rule = /\.cf-input\s*\{([^}]*)\}/.exec(css);
    const body = must(rule?.[1]);
    expect(body).toMatch(/position:\s*absolute/);
    expect(body).toMatch(/inset:\s*0/);
    expect(body).toMatch(/inline-size:\s*100%/);
    expect(body).toMatch(/block-size:\s*100%/);
  });

  it("keeps a cell wide enough for a digit from a 240 px dialog on a 320 px screen up to the 360 px cap", () => {
    // fs-28 is 28 px; a tabular Geist digit is under 0.65 em, so under 18.2 px.
    const digit = 28 * 0.65;
    const narrow = cellWidth(240, 320);
    const wide = cellWidth(360, 1280);
    expect(narrow).toBeGreaterThanOrEqual(digit + 2 * 6);
    expect(wide).toBeGreaterThan(narrow);
    // At 320 px the gap is 2vw, 6.4 px: a cell of about 34 px.
    expect(narrow).toBeCloseTo((240 - 2 - 5 * 6.4) / 6, 5);
  });

  it("keeps the pill narrower than the narrowest field", () => {
    expect(CODE_FIELD_PILL).toBe("11rem");
    expect(Number.parseFloat(CODE_FIELD_PILL) * 16).toBeLessThan(240);
    expect(css).toMatch(/--cf-pill:\s*11rem/);
  });

  it("scales nothing with a transform to fit a screen", () => {
    // The two scales that remain are inside keyframes: the cells on mount and the check.
    const outside = css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outside).not.toMatch(/scale/);
  });

  it("sizes the input at 16 px so a phone does not zoom on focus", () => {
    expect(css).toMatch(/\.cf-input\s*\{[^}]*font-size:\s*var\(--type-16\)/);
    expect(tokensCss).toMatch(/--type-16:\s*1rem/);
  });

  it("uses design tokens only, with no colour written out", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(code).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(code).not.toMatch(/\brgba?\(/);
    expect(code).not.toMatch(/\bhsla?\(/);
  });
});
