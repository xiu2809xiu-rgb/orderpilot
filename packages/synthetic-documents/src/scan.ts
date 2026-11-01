import {
  PDFName,
  concatTransformationMatrix,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
} from "pdf-lib";
import { PAGE, type Box, type Color, type DrawOp } from "./canvas.js";
import { textOutlines } from "./glyphs.js";
import { developed } from "./paper.js";
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
      raster.fill(textOutlines(op, toPixels), luminance(op.color));
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
    bytes: await doc.save({ useObjectStreams: false }),
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
