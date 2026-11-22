import { describe, expect, it } from "vitest";
import {
  INSET,
  KNOB_SIZE,
  TRACK_HEIGHT,
  TRACK_WIDTH,
  TRAVEL,
  cellFill,
  knobGeometry,
  roundedOutline,
  sampleRibbon,
  snapSpan,
} from "./geometry";

describe("the knob's box", () => {
  it("rests 16 units in from the night end and 16 from the day end", () => {
    const night = knobGeometry(0, 0, 0);
    expect(night).toEqual({
      x: INSET,
      y: (TRACK_HEIGHT - KNOB_SIZE) / 2,
      width: KNOB_SIZE,
      height: KNOB_SIZE,
    });
    const day = knobGeometry(1, 0, 0);
    expect(day.x + day.width).toBe(TRACK_WIDTH - INSET);
    expect(day.x - night.x).toBe(TRAVEL);
  });

  it("is centred between the walls half way", () => {
    const half = knobGeometry(0.5, 0, 0);
    expect(half.x + half.width / 2).toBeCloseTo(TRACK_WIDTH / 2, 6);
  });

  it("stays against the wall when dragged past either end, and squashes on it", () => {
    const before = knobGeometry(-0.2, 0, 0);
    expect(before.x).toBe(INSET);
    expect(before.width).toBeLessThan(KNOB_SIZE);
    expect(before.height).toBeGreaterThan(KNOB_SIZE);
    const beyond = knobGeometry(1.2, 0, 0);
    expect(beyond.x + beyond.width).toBe(TRACK_WIDTH - INSET);
    expect(beyond.width).toBeLessThan(KNOB_SIZE);
  });

  it("stretches while it moves and squeezes while it is pressed", () => {
    const stretched = knobGeometry(0.5, 0.18, 0);
    expect(stretched.width).toBeGreaterThan(KNOB_SIZE);
    expect(stretched.height).toBeLessThan(KNOB_SIZE);
    const pressed = knobGeometry(0.5, 0, 1);
    expect(pressed.width).toBeCloseTo(KNOB_SIZE * (1 - 0.055), 6);
    expect(pressed.height).toBeCloseTo(KNOB_SIZE * (1 - 0.055), 6);
  });

  it("never grows or shrinks past its limits, however hard it is squeezed", () => {
    const crushed = knobGeometry(-5, -3, 1);
    expect(crushed.width).toBeGreaterThanOrEqual(KNOB_SIZE * 0.82);
    expect(crushed.height).toBeLessThanOrEqual(KNOB_SIZE * 1.08);
    const huge = knobGeometry(0.5, 3, 0);
    expect(huge.width).toBeLessThanOrEqual(KNOB_SIZE * 1.19);
  });
});

describe("the rounded outline", () => {
  const box = { x: 16, y: 16, width: 240, height: 240 };
  const outline = roundedOutline(box, 69);

  it("has the perimeter of a rounded square", () => {
    const expected = 2 * (240 - 138 + (240 - 138)) + 4 * ((Math.PI * 69) / 2);
    expect(outline.perimeter).toBeCloseTo(expected, 6);
  });

  it("starts at the top middle and closes where it began", () => {
    const [x, y] = outline.point(0);
    expect([x, y]).toEqual([136, 16]);
    const [endX, endY] = outline.point(outline.perimeter);
    expect(endX).toBeCloseTo(x, 6);
    expect(endY).toBeCloseTo(y, 6);
  });

  it("is continuous: a half unit along moves the point by at most a half unit", () => {
    let worst = 0;
    for (let at = 0; at < outline.perimeter; at += 0.5) {
      const [ax, ay] = outline.point(at);
      const [bx, by] = outline.point(at + 0.5);
      worst = Math.max(worst, Math.hypot(bx - ax, by - ay));
    }
    expect(worst).toBeLessThanOrEqual(0.5 + 1e-6);
  });

  it("keeps every point on the box's border", () => {
    for (let at = 0; at < outline.perimeter; at += 7) {
      const [x, y] = outline.point(at);
      expect(x).toBeGreaterThanOrEqual(box.x - 1e-6);
      expect(x).toBeLessThanOrEqual(box.x + box.width + 1e-6);
      expect(y).toBeGreaterThanOrEqual(box.y - 1e-6);
      expect(y).toBeLessThanOrEqual(box.y + box.height + 1e-6);
    }
  });

  it("maps a phase to a place: 0 is the bottom, a quarter turn is the right side, a half turn is the top", () => {
    // The supplied angle is a quarter turn minus the phase in turns, in screen
    // coordinates: the band is at the bottom middle at rest, and turns through
    // the right side to the top, then the left.
    const bottom = outline.point(outline.phaseDistance(0));
    expect(bottom[0]).toBeCloseTo(136, 6);
    expect(bottom[1]).toBeCloseTo(256, 6);
    const right = outline.point(outline.phaseDistance(0.25));
    expect(right[0]).toBeCloseTo(256, 6);
    expect(right[1]).toBeCloseTo(136, 6);
    const left = outline.point(outline.phaseDistance(0.75));
    expect(left[0]).toBeCloseTo(16, 6);
    const top = outline.point(outline.phaseDistance(0.5));
    expect(top[0]).toBeCloseTo(136, 6);
    expect(top[1]).toBeCloseTo(16, 6);
  });

  it("wraps a phase of one turn onto the same place as none", () => {
    const a = outline.point(outline.phaseDistance(0));
    const b = outline.point(outline.phaseDistance(1));
    expect(b[0]).toBeCloseTo(a[0], 6);
    expect(b[1]).toBeCloseTo(a[1], 6);
    const c = outline.point(outline.phaseDistance(-0.25));
    const d = outline.point(outline.phaseDistance(0.75));
    expect(c[0]).toBeCloseTo(d[0], 6);
    expect(c[1]).toBeCloseTo(d[1], 6);
  });

  it("gives a ribbon of 49 points that taper to nothing at both ends", () => {
    const samples = sampleRibbon(outline, 100, 200);
    expect(samples).toHaveLength(49);
    expect(samples[0]?.taper).toBeCloseTo(0, 6);
    expect(samples[48]?.taper).toBeCloseTo(0, 6);
    expect(samples[24]?.taper).toBeCloseTo(1, 6);
    for (const sample of samples) {
      expect(Math.hypot(sample.nx, sample.ny)).toBeCloseTo(1, 6);
    }
  });
});

describe("a glyph cell at the display's density", () => {
  it("leaves no gap between cells when a cell is under 2 device pixels", () => {
    expect(cellFill(0.9)).toBe(1);
    expect(cellFill(1.99)).toBe(1);
  });

  it("keeps the supplied 18% gap from 2 device pixels up", () => {
    expect(cellFill(2)).toBe(0.82);
    expect(cellFill(13.7)).toBe(0.82);
  });

  it("snaps a small cell to rounded edges, so neighbours meet with no seam and none is lost", () => {
    // 6.85 units at 0.13 device pixels a unit: 0.89 pixels a cell.
    const unit = 0.13;
    let previousStop: number | undefined;
    for (let column = -8; column <= 8; column++) {
      const span = snapSpan(column * 6.85, 6.85, unit);
      expect(Number.isInteger(span.start)).toBe(true);
      expect(Number.isInteger(span.size)).toBe(true);
      expect(span.size).toBeGreaterThanOrEqual(1);
      if (previousStop !== undefined) {
        // Never a gap: a cell starts at or before the end of the one before.
        expect(span.start).toBeLessThanOrEqual(previousStop);
      }
      previousStop = span.start + span.size;
    }
  });

  it("gives a large cell one whole width, however far it is from the centre", () => {
    const unit = 0.5;
    const extent = 6.85 * 0.82;
    const sizes = new Set<number>();
    for (let column = -8; column <= 8; column++) {
      const span = snapSpan(column * 6.85, extent, unit);
      expect(Number.isInteger(span.start)).toBe(true);
      sizes.add(span.size);
    }
    expect([...sizes]).toEqual([Math.round(extent * unit)]);
  });

  it("is never thinner than one pixel, even for a cell far under it", () => {
    expect(snapSpan(3.2, 0.5, 0.1).size).toBe(1);
  });
});
