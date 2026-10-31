import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dir = import.meta.dirname;
const tokens = readFileSync(path.join(dir, "tokens.css"), "utf8");
const theme = readFileSync(path.join(dir, "index.css"), "utf8");

/** The custom properties declared inside one selector's block. */
function block(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]),
  ) as Record<string, string>;
}

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

const light = block(tokens, ":root");
const dark = { ...light, ...block(tokens, ".dark") };

// Every text colour against the surface it is drawn on. Text needs 4.5:1.
const TEXT_PAIRS: [string, string][] = [
  ["foreground", "background"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "card"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive-foreground", "destructive"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["primary", "background"],
  ["primary", "card"],
  ["warning", "warning-surface"],
  ["sidebar-foreground", "sidebar"],
  ["sidebar-accent-foreground", "sidebar-accent"],
  ["muted-foreground", "sidebar"],
];

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme contrast", (_name, colours) => {
  it.each(TEXT_PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    const ratio = contrast(colours[fg] ?? "", colours[bg] ?? "");
    expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the focus ring and input borders visible (3:1)", () => {
    expect(
      contrast(colours.ring ?? "", colours.background ?? ""),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(colours.input ?? "", colours.background ?? ""),
    ).toBeGreaterThanOrEqual(1.4);
  });
});

describe("the contrast function", () => {
  it("is 21:1 for black on white and 1:1 for equal colours", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("fails a pair that is too pale", () => {
    expect(contrast("#999999", "#ffffff")).toBeLessThan(4.5);
  });
});

describe("the other tokens", () => {
  it("has a dark value for every colour that is not shared", () => {
    for (const name of Object.keys(light).filter(
      (n) => !/^(radius|space|motion|ease|shadow)/.test(n),
    )) {
      expect(Object.keys(block(tokens, ".dark")), name).toContain(name);
    }
  });

  it("puts every spacing token on the 8-pt grid", () => {
    const spaces = Object.entries(light).filter(([name]) =>
      name.startsWith("space-"),
    );
    expect(spaces.length).toBeGreaterThan(0);
    for (const [name, value] of spaces) {
      expect((parseFloat(value) * 16) % 8, name).toBe(0);
    }
  });

  it("keeps motion between 150 and 250 ms", () => {
    for (const name of ["motion-fast", "motion-base", "motion-slow"]) {
      const ms = parseInt(light[name] ?? "", 10);
      expect(ms, name).toBeGreaterThanOrEqual(150);
      expect(ms, name).toBeLessThanOrEqual(250);
    }
  });

  it("defines radius and an ease-out curve", () => {
    expect(light.radius).toBeDefined();
    expect(light["ease-out"]).toContain("cubic-bezier");
  });

  it("defines at most 7 type sizes", () => {
    const sizes = [...theme.matchAll(/--text-([\w]+):\s*[\d.]+rem;/g)];
    expect(sizes.length).toBeGreaterThan(0);
    expect(sizes.length).toBeLessThanOrEqual(7);
  });
});
