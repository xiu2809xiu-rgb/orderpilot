import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ALPHA,
  PALETTE,
  blend,
  clamp,
  mix,
  paletteVariables,
  parseColor,
  rgba,
  wrap,
} from "./palette";

const css = readFileSync(
  path.join(import.meta.dirname, "pixelToggle.css"),
  "utf8",
);

describe("colour maths", () => {
  it("parses a hex colour", () => {
    expect(parseColor("53535b")).toEqual([83, 83, 91]);
  });

  it("blends to the first colour at 0 and the second at 1", () => {
    expect(blend([0, 0, 0], [255, 100, 50], 0)).toEqual([0, 0, 0]);
    expect(blend([0, 0, 0], [255, 100, 50], 1)).toEqual([255, 100, 50]);
    expect(blend([0, 0, 0], [255, 100, 50], 0.5)).toEqual([128, 50, 25]);
  });

  it("clamps, mixes and wraps", () => {
    expect(clamp(2)).toBe(1);
    expect(clamp(-2)).toBe(0);
    expect(mix(10, 20, 0.25)).toBe(12.5);
    expect(wrap(-0.25, 1)).toBeCloseTo(0.75, 10);
    expect(wrap(1.25, 1)).toBeCloseTo(0.25, 10);
  });

  it("writes a colour for CSS", () => {
    expect(rgba([1, 2, 3], 0.5)).toBe("rgba(1,2,3,0.5)");
  });
});

describe("the palette", () => {
  it("is the night palette at 0 and the day palette at 1", () => {
    const night = paletteVariables(0);
    const day = paletteVariables(1);
    for (const name of Object.keys(PALETTE) as (keyof typeof PALETTE)[]) {
      const [nightHex, dayHex] = PALETTE[name];
      const alpha = ALPHA[name];
      expect(night[`--pt-${name}`]).toBe(
        rgba(parseColor(nightHex), alpha ? alpha[0] : 1),
      );
      expect(day[`--pt-${name}`]).toBe(
        rgba(parseColor(dayHex), alpha ? alpha[1] : 1),
      );
    }
  });

  it("lies between the two ends half way", () => {
    expect(paletteVariables(0.5)["--pt-track-top"]).toBe(
      rgba(blend(parseColor("09090a"), parseColor("dededd"), 0.5)),
    );
  });

  it("is repeated in the sheet for the first paint, night as the base and day when checked", () => {
    // pixelToggle.css draws the track before the engine runs, so its two sets
    // of values must be the palette's.
    const squash = (text: string) => text.replaceAll(/\s+/g, "");
    const block = (selector: string) => {
      const start = css.indexOf(`${selector} {`);
      expect(start).toBeGreaterThan(-1);
      return css.slice(start, css.indexOf("}", start));
    };
    for (const [end, selector] of [
      [0, ".pixel-switch"],
      [1, '.pixel-switch[aria-checked="true"]'],
    ] as const) {
      const text = squash(block(selector));
      for (const [name, value] of Object.entries(paletteVariables(end))) {
        expect(text).toContain(`${name}:${squash(value)};`);
      }
    }
  });

  it("sizes the switch from the bar's --bar-ctl, which the sign-in test sets for its corner", () => {
    expect(css).toContain("var(--bar-ctl");
  });
});
