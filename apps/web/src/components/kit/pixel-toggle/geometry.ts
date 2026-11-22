import { clamp, mix, wrap } from "./palette";

/** The switch is drawn on a 520 x 272 track; every length below is in those units. */
export const TRACK_WIDTH = 520;
export const TRACK_HEIGHT = 272;
export const TRACK_RADIUS = 86;
export const KNOB_SIZE = 240;
export const INSET = 16;
export const TRAVEL = 248;
export const KNOB_RADIUS = 69;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The knob's box. `position` is 0 (night end) to 1 (day end), and may go past
 * either end while it is dragged or springs back. A stretch makes it longer
 * and flatter, a press squeezes it, and an overshoot squashes it on the wall.
 */
export function knobGeometry(
  position: number,
  stretch: number,
  press: number,
): Box {
  const overshoot = Math.max(-position, position - 1, 0);
  const impact = Math.min(0.16, overshoot * 1.12);
  const squeeze = 1 - press * 0.055;
  const width = KNOB_SIZE * clamp((1 + stretch - impact) * squeeze, 0.82, 1.19);
  const height =
    KNOB_SIZE *
    clamp((1 - stretch * 0.45 + impact * 0.42) * squeeze, 0.85, 1.08);
  const center = INSET + KNOB_SIZE / 2 + clamp(position) * TRAVEL;
  const x =
    position > 1
      ? TRACK_WIDTH - INSET - width
      : position < 0
        ? INSET
        : clamp(center - width / 2, INSET, TRACK_WIDTH - INSET - width);
  return { x, y: (TRACK_HEIGHT - height) / 2, width, height };
}

interface Segment {
  end: number;
  length: number;
  point: (t: number) => [number, number];
}

export interface Outline {
  point: (distance: number) => [number, number];
  /** Where on the outline the band of light sits for a phase (one turn is 1). */
  phaseDistance: (phase: number) => number;
  perimeter: number;
  center: { x: number; y: number };
}

/** A rounded rectangle as a path of lines and quarter circles, starting at the top middle. */
export function roundedOutline(
  { x, y, width, height }: Box,
  radius: number,
): Outline {
  const right = x + width;
  const bottom = y + height;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const r = Math.min(radius, width / 2, height / 2);
  const corner = (Math.PI * r) / 2;
  const horizontal = width - 2 * r;
  const vertical = height - 2 * r;
  const perimeter = 2 * (horizontal + vertical) + 4 * corner;
  const quarter = horizontal / 2 + corner + vertical / 2;
  const opposite = horizontal + 2 * corner + vertical;
  const segments: Segment[] = [];
  let end = 0;
  const line = (sx: number, sy: number, tx: number, ty: number) => {
    const length = Math.hypot(tx - sx, ty - sy);
    if (length) {
      end += length;
      segments.push({
        end,
        length,
        point: (t) => [mix(sx, tx, t), mix(sy, ty, t)],
      });
    }
  };
  const curve = (ox: number, oy: number, start: number) => {
    end += corner;
    segments.push({
      end,
      length: corner,
      point: (t) => {
        const angle = start + (t * Math.PI) / 2;
        return [ox + Math.cos(angle) * r, oy + Math.sin(angle) * r];
      },
    });
  };
  line(cx, y, right - r, y);
  curve(right - r, y + r, -Math.PI / 2);
  line(right, y + r, right, bottom - r);
  curve(right - r, bottom - r, 0);
  line(right - r, bottom, x + r, bottom);
  curve(x + r, bottom - r, Math.PI / 2);
  line(x, bottom - r, x, y + r);
  curve(x + r, y + r, Math.PI);
  line(x + r, y, cx, y);
  const point = (distance: number): [number, number] => {
    const at = wrap(distance, perimeter);
    const segment = segments.find((item) => at <= item.end) ?? segments.at(-1);
    return segment
      ? segment.point(1 - (segment.end - at) / segment.length)
      : [cx, y];
  };
  const phaseDistance = (phase: number) => {
    const turn = wrap(phase, 1) * 4;
    const side = Math.floor(turn);
    const sides = [opposite, quarter, 0, quarter + opposite, opposite];
    const from = side === 2 ? perimeter : (sides[side] ?? 0);
    return mix(from, sides[side + 1] ?? 0, turn - side);
  };
  return { point, phaseDistance, perimeter, center: { x: cx, y: cy } };
}

export interface RibbonSample {
  x: number;
  y: number;
  nx: number;
  ny: number;
  taper: number;
}

/** Forty-nine points along an outline, each with its normal and a taper that fades the ends. */
export function sampleRibbon(
  outline: Outline,
  distance: number,
  length: number,
): RibbonSample[] {
  return Array.from({ length: 49 }, (_, i) => {
    const fraction = i / 48;
    const at = distance + (fraction - 0.5) * length;
    const [x, y] = outline.point(at);
    const [ax, ay] = outline.point(at - 1);
    const [bx, by] = outline.point(at + 1);
    const span = Math.hypot(bx - ax, by - ay) || 1;
    return {
      x,
      y,
      nx: (by - ay) / span,
      ny: (ax - bx) / span,
      taper: Math.sin(Math.PI * fraction),
    };
  });
}

/**
 * How much of a glyph cell is drawn. The supplied toggle left a gap of 18% so
 * the cells read as pixels; under 2 device pixels a cell is too small to
 * leave a gap, and the gap would drop whole cells, so it is filled.
 */
export function cellFill(cellDevicePixels: number): number {
  return cellDevicePixels < 2 ? 1 : 0.82;
}

/**
 * A cell's span on one axis, in whole device pixels, from a centre and an
 * extent in track units and a scale of device pixels per unit. A cell of 2
 * device pixels or more keeps one width, so neighbours match. A smaller one
 * is cut at rounded edges, so neighbours meet with no seam, and is never
 * thinner than one pixel.
 */
export function snapSpan(
  centre: number,
  extent: number,
  unit: number,
): { start: number; size: number } {
  const wide = extent * unit;
  if (wide >= 2) {
    const size = Math.round(wide);
    return { start: Math.round(centre * unit - size / 2), size };
  }
  const start = Math.round((centre - extent / 2) * unit);
  const stop = Math.round((centre + extent / 2) * unit);
  return { start, size: Math.max(1, stop - start) };
}
