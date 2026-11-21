import { describe, expect, it } from "vitest";
import seeds from "./orbSeeds.json";
import { orbColours, type OrbTokens, type Rgb } from "./orbPalette";

const hex = (value: string): Rgb => [
  parseInt(value.slice(1, 3), 16) / 255,
  parseInt(value.slice(3, 5), 16) / 255,
  parseInt(value.slice(5, 7), 16) / 255,
];
const luminance = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// The real tokens of tokens.css, in both schemes.
const LIGHT: OrbTokens = {
  ground: hex("#ffffff"),
  accent: hex("#0e7c86"),
  info: hex("#2f4fd0"),
  ink: hex("#0b2239"),
};
const DARK: OrbTokens = {
  ground: hex("#0a1c30"),
  accent: hex("#2ee6d6"),
  info: hex("#9db0ff"),
  ink: hex("#f1fbfb"),
};

describe("the idle orb's bands", () => {
  it.each([
    ["light", LIGHT],
    ["dark", DARK],
  ])(
    "are far enough apart in lightness, in %s, for the flow to show itself",
    (_scheme, tokens) => {
      const { a, b, c, d } = orbColours(tokens, "idle");
      const lit = [b, c, d].map(luminance);
      // Every lit band stands clear of the dark base the curtains drift over.
      expect(Math.min(...lit) - luminance(a)).toBeGreaterThanOrEqual(0.2);
      // And the bands differ from one another, so a band crossing another shows.
      expect(Math.max(...lit) - Math.min(...lit)).toBeGreaterThanOrEqual(0.28);
    },
  );

  it("are mixed from the design tokens, so each scheme has its own", () => {
    const light = orbColours(LIGHT, "idle");
    const dark = orbColours(DARK, "idle");
    expect(light.b).not.toEqual(dark.b);
    expect(light.c).not.toEqual(dark.c);
    // Change one token and the bands that are mixed from it follow.
    const moved = orbColours({ ...LIGHT, info: DARK.info }, "idle");
    expect(moved.c).not.toEqual(light.c);
    expect(moved.b).toEqual(light.b);
  });
});

describe("how fast each state flows", () => {
  const speed = (state: "idle" | "thinking") => seeds[state][3] ?? 0;

  it("lets idle drift a visible distance each second, and still gently", () => {
    // The aurora moves by speed times 0.18 radians a second (liquidOrb.wgsl,
    // glsAuroraLayer): the old 0.66 moved the curtains about a tenth of their
    // width in a second, which nobody sees.
    expect(speed("idle")).toBeGreaterThanOrEqual(1.2);
    expect(speed("idle")).toBeLessThanOrEqual(2.5);
  });

  it("makes thinking clearly livelier than idle", () => {
    expect(speed("thinking")).toBeGreaterThanOrEqual(1.5 * speed("idle"));
  });
});
