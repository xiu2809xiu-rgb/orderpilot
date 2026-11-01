import type { TextOp } from "./canvas.js";
import { layoutText, loadFont } from "./fonts.js";
import type { Outline, Point } from "./raster.js";

interface Sink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
  bezierCurveTo(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): void;
  closePath(): void;
}

const CURVE_STEPS = 5;

/**
 * The outlines of a line of text, with every point passed through `map`: the
 * scan maps page points to pixels on a tilted sheet, a test maps them to a
 * plain grid.
 */
export function textOutlines(
  op: TextOp,
  map: (point: Point) => Point,
): Outline[] {
  const { face } = loadFont(op.font);
  const unit = op.size / face.unitsPerEm;
  const outlines: Outline[] = [];
  for (const { glyph, at } of layoutText(op.font, op.text).placed) {
    const originX = op.x + at * op.size;
    const place = (gx: number, gy: number): Point =>
      map([originX + gx * unit, op.y - gy * unit]);
    let contour: Point[] = [];
    let pen: Point = [0, 0];
    const sink: Sink = {
      moveTo: (x, y) => {
        contour = [];
        pen = [x, y];
        contour.push(place(x, y));
      },
      lineTo: (x, y) => {
        pen = [x, y];
        contour.push(place(x, y));
      },
      quadraticCurveTo: (cx, cy, x, y) => {
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          const u = 1 - t;
          contour.push(
            place(
              u * u * pen[0] + 2 * u * t * cx + t * t * x,
              u * u * pen[1] + 2 * u * t * cy + t * t * y,
            ),
          );
        }
        pen = [x, y];
      },
      bezierCurveTo: (c1x, c1y, c2x, c2y, x, y) => {
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          const u = 1 - t;
          contour.push(
            place(
              u * u * u * pen[0] +
                3 * u * u * t * c1x +
                3 * u * t * t * c2x +
                t * t * t * x,
              u * u * u * pen[1] +
                3 * u * u * t * c1y +
                3 * u * t * t * c2y +
                t * t * t * y,
            ),
          );
        }
        pen = [x, y];
      },
      closePath: () => {
        if (contour.length > 2) outlines.push(contour);
        contour = [];
      },
    };
    (glyph.path.toFunction() as (sink: Sink) => void)(sink);
  }
  return outlines;
}
