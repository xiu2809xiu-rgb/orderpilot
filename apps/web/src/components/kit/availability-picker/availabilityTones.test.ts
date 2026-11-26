import { PERSON_AVAILABILITIES } from "@orderpilot/shared";
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
import { AVAILABILITY_ORDER, availabilityLook } from "./tones";

const here = import.meta.dirname;
const tokensCss = readFileSync(
  path.join(here, "../../../styles/tokens.css"),
  "utf8",
);
const read = (file: string) => readFileSync(path.join(here, file), "utf8");
const dotCss = read("availabilityDot.css");

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

const light: Tokens = block(tokensCss, ":root");
const dark: Tokens = { ...light, ...block(tokensCss, ".dark") };

describe("the three availabilities", () => {
  it("has its own mark and its own tone for each value", () => {
    const marks = PERSON_AVAILABILITIES.map((v) => availabilityLook[v].mark);
    const tones = PERSON_AVAILABILITIES.map((v) => availabilityLook[v].tone);
    expect(new Set(marks).size).toBe(3);
    expect(new Set(tones).size).toBe(3);
  });

  it("lists the values in the order of the pill", () => {
    expect([...AVAILABILITY_ORDER]).toEqual([...PERSON_AVAILABILITIES]);
  });

  it("draws every mark in the colour that is measured below, on a dot and on an orb", () => {
    const orb = read("availabilityPicker.css");
    expect(dotCss).toMatch(
      /\.ap-dot\s*{[^}]*color: var\(--destructive-foreground\)/s,
    );
    expect(orb).toMatch(
      /\.ap-orb\s*{[^}]*color: var\(--destructive-foreground\)/s,
    );
  });

  it("paints each tone in the sheet from the token of that name", () => {
    for (const value of PERSON_AVAILABILITIES) {
      const { tone } = availabilityLook[value];
      expect(dotCss).toContain(
        `.ap-dot[data-value="${value}"] {\n  --ap-tone: var(--${tone});`,
      );
    }
  });
});

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("the availability colours in the %s scheme", (_scheme, t) => {
  const colour = (name: string) => parseColor(must(t[name]));
  const glass = (popoverShare: number) =>
    flatten(
      { ...colour("popover"), a: popoverShare },
      surface(t, ["background"]),
    );

  it("keeps each mark at 4.5:1 on its tone", () => {
    for (const value of PERSON_AVAILABILITIES) {
      const tone = colour(availabilityLook[value].tone);
      expect(
        contrast(colour("destructive-foreground"), tone),
        `${value} mark on its tone`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps each tone at 3:1 on the popover, the page and the pill's glass", () => {
    for (const value of PERSON_AVAILABILITIES) {
      const tone = colour(availabilityLook[value].tone);
      for (const [what, ground] of [
        ["popover", colour("popover")],
        ["background", surface(t, ["background"])],
        ["glass", glass(0.78)],
      ] as const) {
        expect(
          contrast(tone, ground),
          `${value} on the ${what}`,
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps the foreground at 4.5:1 on the pill's glass in the worst case", () => {
    expect(contrast(colour("foreground"), glass(0.78))).toBeGreaterThanOrEqual(
      4.5,
    );
  });

  it("keeps the caption's text at 4.5:1 on its fill", () => {
    const fill = flatten({ ...colour("popover"), a: 0.9 }, glass(0.78));
    expect(contrast(colour("foreground"), fill)).toBeGreaterThanOrEqual(4.5);
  });
});
