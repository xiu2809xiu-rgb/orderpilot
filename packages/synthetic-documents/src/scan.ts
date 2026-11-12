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
  pages: number;
  /** Where a box on the straight page ended up on the scanned one, in points. Pages count from 1. */
  moveBox: (box: Box, page?: number) => Box;
}

// 100 dots an inch: what an office copier sends by email, and still readable.
const SCALE = 100 / 72;
const WIDTH = Math.round(PAGE.width * SCALE);
const HEIGHT = Math.round(PAGE.height * SCALE);

/**
 * How each sheet lies on the glass: a little off square and off centre, and
 * not the same for the next sheet, as when pages are laid on by hand. The sine
 * and cosine are written out so no platform's maths library can change a
 * pixel. The first sheet is the one every single-page scan has always had.
 */
export interface Tilt {
  degrees: number;
  cos: number;
  sin: number;
  shift: Point;
}
export const TILTS: readonly Tilt[] = [
  { degrees: 0.9, cos: 0.99987663, sin: 0.01570732, shift: [5, 8] },
  { degrees: -0.5, cos: 0.99996192, sin: -0.00872654, shift: [-4, 5] },
  { degrees: 0.6, cos: 0.99994517, sin: 0.01047178, shift: [3, -6] },
  { degrees: -0.3, cos: 0.99998629, sin: -0.00523596, shift: [-6, 7] },
];

/** The tilt of a page, counting pages from 1: the four repeat. */
export function tiltOf(page: number): Tilt {
  const found = TILTS[(page - 1) % TILTS.length];
  if (!found) throw new RangeError(`There is no page ${String(page)}`);
  return found;
}

const luminance = ([r, g, b]: Color): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/** A point on the straight page to the same point on the tilted sheet, in points. */
function tilt([x, y]: Point, page: number): Point {
  const { cos, sin, shift } = tiltOf(page);
  const cx = PAGE.width / 2;
  const cy = PAGE.height / 2;
  const rx = x - cx;
  const ry = y - cy;
  return [
    cx + rx * cos - ry * sin + shift[0],
    cy + rx * sin + ry * cos + shift[1],
  ];
}

const toPixels = (point: Point, page: number): Point => {
  const [x, y] = tilt(point, page);
  return [x * SCALE, y * SCALE];
};

function rectOutline(box: Box, page: number): Outline {
  return [
    toPixels([box.x, box.y], page),
    toPixels([box.x + box.w, box.y], page),
    toPixels([box.x + box.w, box.y + box.h], page),
    toPixels([box.x, box.y + box.h], page),
  ];
}

function drawOps(raster: Raster, ops: readonly DrawOp[], page: number): void {
  for (const op of ops) {
    if (op.kind === "text") {
      raster.fill(
        textOutlines(op, (point) => toPixels(point, page)),
        luminance(op.color),
      );
    } else if (op.kind === "line") {
      raster.fill(
        [
          stroke(
            toPixels(op.from, page),
            toPixels(op.to, page),
            Math.max(1, op.lineWidth * SCALE),
          ),
        ],
        luminance(op.color),
      );
    } else {
      if (op.fill) {
        raster.fill([rectOutline(op.box, page)], luminance(op.fill));
      }
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
              toPixels(corner, page),
              toPixels(corners[(i + 1) % 4] ?? corner, page),
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
 * Turns every page into what a copier makes of it: an image and nothing else,
 * so there is no text for a reader to extract. Each sheet is tilted on a dark
 * backdrop, grey, softened and flecked, and each has its own tilt and its own
 * specks.
 */
export async function scanPages(
  pages: readonly (readonly DrawOp[])[],
  meta: PdfMeta,
): Promise<Scan> {
  if (pages.length === 0) throw new RangeError("A scan needs a page");
  const doc = await newPdf(meta);
  pages.forEach((ops, index) => {
    const number = index + 1;
    const raster = new Raster(WIDTH, HEIGHT, 0.14);
    raster.fill(
      [rectOutline({ x: 0, y: 0, w: PAGE.width, h: PAGE.height }, number)],
      1,
    );
    drawOps(raster, ops, number);

    const page = doc.addPage([PAGE.width, PAGE.height]);
    const stream = doc.context.flateStream(developed(raster, index), {
      Type: PDFName.of("XObject"),
      Subtype: PDFName.of("Image"),
      Width: WIDTH,
      Height: HEIGHT,
      ColorSpace: PDFName.of("DeviceGray"),
      BitsPerComponent: 8,
    });
    // The first page keeps the name it has always had.
    const name = page.node.newXObject(
      index === 0 ? "Scan" : `Scan${String(number)}`,
      doc.context.register(stream),
    );
    page.pushOperators(
      pushGraphicsState(),
      concatTransformationMatrix(PAGE.width, 0, 0, PAGE.height, 0, 0),
      drawObject(name),
      popGraphicsState(),
    );
  });
  return {
    bytes: await doc.save({ useObjectStreams: false }),
    pages: pages.length,
    moveBox: (box, page = 1) => {
      const corners = [
        tilt([box.x, box.y], page),
        tilt([box.x + box.w, box.y], page),
        tilt([box.x + box.w, box.y + box.h], page),
        tilt([box.x, box.y + box.h], page),
      ];
      const xs = corners.map((c) => c[0]);
      const ys = corners.map((c) => c[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    },
  };
}
