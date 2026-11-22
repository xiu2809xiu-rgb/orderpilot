import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEFT_SIDE_BEARING_600,
  opticalInset,
  opticalStyle,
} from "./opticalEdge";

/*
 * The table is checked against the font file itself. fontkit's plain read
 * gives weight 400; weight 600 is that outline moved by the font's own
 * variation deltas, which is what the browser does, so the test runs the same
 * deltas. fontkit lives in packages/synthetic-documents, which is why it is
 * loaded from there.
 */
const ROOT = path.resolve(import.meta.dirname, "../../../..");
const requireFromDocs = createRequire(
  path.join(ROOT, "packages/synthetic-documents/package.json"),
);
const fontkitModule = requireFromDocs("@pdf-lib/fontkit") as {
  default?: FontkitApi;
} & FontkitApi;
const fontkit: FontkitApi = fontkitModule.default ?? fontkitModule;

/** A point as fontkit's variation code wants it: it calls copy() on each. */
class Point {
  constructor(
    public x: number,
    public y: number,
    public onCurve = true,
    public endContour = false,
  ) {}
  copy(): Point {
    return new Point(this.x, this.y, this.onCurve, this.endContour);
  }
}
interface Glyph {
  id: number;
  advanceWidth: number;
}
interface Font {
  glyphForCodePoint(code: number): Glyph;
  getGlyph(id: number): Glyph;
  variationCoords: number[];
  _variationProcessor: {
    transformPoints(id: number, points: Point[]): void;
  };
  _transformedGlyphs: Record<number, { points?: Point[] }>;
}
interface FontkitApi {
  create(buffer: Buffer): Font;
}

const GEIST = readFileSync(
  path.join(
    ROOT,
    "apps/web/node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
  ),
);

/** The left side bearing of a character at a weight, in font units. */
function bearingAt(weight: number, char: string): number {
  const plain = fontkit.create(GEIST);
  const id = plain.glyphForCodePoint(char.codePointAt(0) ?? 0).id;
  plain.getGlyph(id); // decodes the outline once, without variations
  const outline = plain._transformedGlyphs[id]?.points ?? [];
  const moved = fontkit.create(GEIST);
  moved.variationCoords = [weight];
  // The four phantom points at the end of the list carry the advance.
  const withPhantoms = [
    ...outline.map((p) => new Point(p.x, p.y, p.onCurve, p.endContour)),
    new Point(0, 0, true, true),
    new Point(plain.getGlyph(id).advanceWidth, 0, true, true),
    new Point(0, 0, true, true),
    new Point(0, 0, true, true),
  ];
  moved._variationProcessor.transformPoints(id, withPhantoms);
  const xs = withPhantoms.slice(0, outline.length).map((p) => p.x);
  return Math.round(Math.min(...xs));
}

describe("the left side bearing table", () => {
  it("agrees with the Geist font file at weight 600, within one unit", () => {
    for (const [char, expected] of Object.entries(LEFT_SIDE_BEARING_600)) {
      expect(
        Math.abs(bearingAt(600, char) - expected),
        `${char} at weight 600`,
      ).toBeLessThanOrEqual(1);
    }
  });

  it("reads the font file in a way that tells weights apart", () => {
    // A stem letter's space shrinks as the weight grows: 92 at 400, 80 at 600.
    // If both came out equal the table would be checked against nothing.
    expect(bearingAt(400, "H")).toBeGreaterThan(bearingAt(600, "H") + 8);
  });
});

describe("opticalInset", () => {
  it("pulls a stem letter left by its own space, in em", () => {
    expect(opticalInset("Needs you")).toBe("-0.08em");
    expect(opticalInset("My timeline")).toBe("-0.08em");
  });

  it("pulls a round letter less and a diagonal one hardly at all", () => {
    expect(opticalInset("Good morning, Priya")).toBe("-0.043em");
    expect(opticalInset("Orders")).toBe("-0.043em");
    expect(opticalInset("Tracker")).toBe("-0.011em");
    expect(opticalInset("Approvals")).toBe("-0.019em");
  });

  it("pushes the one letter that overhangs, Y, in by its overhang", () => {
    expect(opticalInset("Your numbers")).toBe("0.007em");
  });

  it("starts at the first visible character", () => {
    expect(opticalInset("  Orders")).toBe("-0.043em");
    expect(opticalInset("2026 plan")).toBe("-0.059em");
  });

  it("leaves a first character it has not measured alone", () => {
    expect(opticalInset("orders")).toBe("0em");
    expect(opticalInset("")).toBe("0em");
    expect(opticalInset('"Quoted"')).toBe("0em");
  });

  it("is handed to the heading as the --optical-inset property", () => {
    expect(opticalStyle("Needs you")).toEqual({ "--optical-inset": "-0.08em" });
  });
});
