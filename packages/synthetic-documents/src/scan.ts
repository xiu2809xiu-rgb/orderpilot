import {
  PDFName,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
} from "pdf-lib";
import {
  PAGE,
  type Box,
  type Color,
  type DrawOp,
  type TextOp,
} from "./canvas.js";
import { layoutText, loadFont } from "./fonts.js";
import { newPdf, type PdfMeta } from "./pdf.js";
import { Raster, stroke, type Outline, type Point } from "./raster.js";

export interface Scan {
  bytes: Uint8Array;
  /** Where a box on the straight page ended up on the scanned one, in points. */
  moveBox: (box: Box) => Box;
}

// 100 dots an inch: what an office copier sends by email, and still readable.
const SCALE = 100 / 72;
const WIDTH = Math.round(PAGE.width * SCALE);
const HEIGHT = Math.round(PAGE.height * SCALE);

// The sheet lies 0.9 degrees off square, as pasted on the glass by hand. The
// sine and cosine are written out so no platform's maths library can change a pixel.
const COS = 0.99987663;
const SIN = 0.01570732;
const SHIFT: Point = [5, 8];

const luminance = ([r, g, b]: Color): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A point on the straight page to the same point on the tilted sheet, in points. */
function tilt([x, y]: Point): Point {
  const cx = PAGE.width / 2;
  const cy = PAGE.height / 2;
  const rx = x - cx;
  const ry = y - cy;
  return [
    cx + rx * COS - ry * SIN + SHIFT[0],
    cy + rx * SIN + ry * COS + SHIFT[1],
  ];
}

const toPixels = (point: Point): Point => {
  const [x, y] = tilt(point);
  return [x * SCALE, y * SCALE];
};

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

/** The outlines of a line of text, in pixels on the sheet. */
function textOutlines(op: TextOp): Outline[] {
  const { face } = loadFont(op.font);
  const unit = op.size / face.unitsPerEm;
  const outlines: Outline[] = [];
  for (const { glyph, at } of layoutText(op.font, op.text).placed) {
    const originX = op.x + at * op.size;
    const place = (gx: number, gy: number): Point =>
      toPixels([originX + gx * unit, op.y - gy * unit]);
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

function rectOutline(box: Box): Outline {
  return [
    toPixels([box.x, box.y]),
    toPixels([box.x + box.w, box.y]),
    toPixels([box.x + box.w, box.y + box.h]),
    toPixels([box.x, box.y + box.h]),
  ];
}

function drawOps(raster: Raster, ops: readonly DrawOp[]): void {
  for (const op of ops) {
    if (op.kind === "text") {
      raster.fill(textOutlines(op), luminance(op.color));
    } else if (op.kind === "line") {
      raster.fill(
        [
          stroke(
            toPixels(op.from),
            toPixels(op.to),
            Math.max(1, op.lineWidth * SCALE),
          ),
        ],
        luminance(op.color),
      );
    } else {
      if (op.fill) raster.fill([rectOutline(op.box)], luminance(op.fill));
      if (op.stroke) {
        const { x, y, w, h } = op.box;
        const corners: Point[] = [
          [x, y],
          [x + w, y],
          [x + w, y + h],
          [x, y + h],
        ];
        const width = Math.max(1, op.lineWidth * SCALE);
        raster.fill(
          corners.map((corner, i) =>
            stroke(
              toPixels(corner),
              toPixels(corners[(i + 1) % 4] ?? corner),
              width,
            ),
          ),
          luminance(op.stroke),
        );
      }
    }
  }
}

/** A hash of a position in [0, 1): the paper's grain and dirt come from here, not from a seed. */
function grain(x: number, y: number, salt: number): number {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(salt, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const SPECK_CELL = 26;

/** Grey paper, uneven light, grain, a copier streak and dust. Returns 8-bit pixels. */
function developed(raster: Raster): Uint8Array {
  const out = new Uint8Array(WIDTH * HEIGHT);
  const { value } = raster;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const at = y * WIDTH + x;
      // A touch of softness: the scanner lens does not resolve single pixels.
      const left = value[at - (x > 0 ? 1 : 0)] ?? 1;
      const right = value[at + (x < WIDTH - 1 ? 1 : 0)] ?? 1;
      const up = value[at - (y > 0 ? WIDTH : 0)] ?? 1;
      const down = value[at + (y < HEIGHT - 1 ? WIDTH : 0)] ?? 1;
      const soft = 0.5 * (value[at] ?? 1) + 0.125 * (left + right + up + down);
      const dx = x / WIDTH - 0.45;
      const dy = y / HEIGHT - 0.5;
      const light = 0.85 - 0.16 * (dx * dx + dy * dy) - 0.04 * (x / WIDTH);
      const noise = (grain(x, y, 1) + grain(x, y, 2) - 1) * 0.018;
      const streak =
        x === Math.round(WIDTH * 0.83) || x === Math.round(WIDTH * 0.83) + 1
          ? -0.035
          : 0;
      out[at] = Math.round(
        Math.min(1, Math.max(0, soft * (light + noise + streak))) * 255,
      );
    }
  }
  for (let cy = 0; cy < Math.ceil(HEIGHT / SPECK_CELL); cy++) {
    for (let cx = 0; cx < Math.ceil(WIDTH / SPECK_CELL); cx++) {
      if (grain(cx, cy, 3) > 0.07) continue;
      const px = cx * SPECK_CELL + grain(cx, cy, 4) * SPECK_CELL;
      const py = cy * SPECK_CELL + grain(cx, cy, 5) * SPECK_CELL;
      const radius = 0.7 + grain(cx, cy, 6) * 1.1;
      const darkness = 0.35 + grain(cx, cy, 7) * 0.45;
      for (let y = Math.floor(py - 3); y <= Math.ceil(py + 3); y++) {
        for (let x = Math.floor(px - 3); x <= Math.ceil(px + 3); x++) {
          if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) continue;
          const distance = Math.sqrt((x - px) * (x - px) + (y - py) * (y - py));
          if (distance > radius + 0.8) continue;
          const cover = Math.min(1, radius + 0.8 - distance) * darkness;
          const at = y * WIDTH + x;
          out[at] = Math.round((out[at] ?? 0) * (1 - cover));
        }
      }
    }
  }
  return out;
}

/**
 * Turns the first page into what a copier makes of it: an image and nothing
 * else, so there is no text for a reader to extract. The sheet is tilted on a
 * dark backdrop, grey, softened and flecked.
 */
export async function scanPages(
  pages: readonly (readonly DrawOp[])[],
  meta: PdfMeta,
): Promise<Scan> {
  const ops = pages[0];
  if (pages.length !== 1 || !ops) throw new RangeError("A scan is one page");
  const raster = new Raster(WIDTH, HEIGHT, 0.14);
  raster.fill([rectOutline({ x: 0, y: 0, w: PAGE.width, h: PAGE.height })], 1);
  drawOps(raster, ops);

  const doc = await newPdf(meta);
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const stream = doc.context.flateStream(developed(raster), {
    Type: PDFName.of("XObject"),
    Subtype: PDFName.of("Image"),
    Width: WIDTH,
    Height: HEIGHT,
    ColorSpace: PDFName.of("DeviceGray"),
    BitsPerComponent: 8,
  });
  const name = page.node.newXObject("Scan", doc.context.register(stream));
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(PAGE.width, 0, 0, PAGE.height, 0, 0),
    drawObject(name),
    popGraphicsState(),
  );
  return {
    bytes: await doc.save(),
    moveBox: (box) => {
      const corners = [
        tilt([box.x, box.y]),
        tilt([box.x + box.w, box.y]),
        tilt([box.x + box.w, box.y + box.h]),
        tilt([box.x, box.y + box.h]),
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    },
  };
}
