import type { BoxFractions } from "../model.js";
import type { GreyImage } from "./pdf-reader.js";

export interface Ink {
  /** Dark pixels inside the field's box. */
  within: number;
  /** Dark pixels in a one-point ring just outside it. */
  around: number;
}

/**
 * Counts the ink in and around a box, given as fractions of the page, on one page of a scan. A scan has
 * no text to read back, so this is how a test knows the box is on the letters.
 * `light` looks for white ink on a dark band instead.
 */
export function inkAround(
  image: GreyImage,
  page: { width: number; height: number },
  fractions: BoxFractions,
  light = false,
): Ink {
  const toPixels = image.width / page.width;
  const [fx, fy, fw, fh] = fractions;
  const box = {
    x: fx * page.width,
    y: fy * page.height,
    w: fw * page.width,
    h: fh * page.height,
  };
  const pixel = (x: number, y: number): number =>
    image.pixels[y * image.width + x] ?? 255;
  const ink = (x: number, y: number): boolean =>
    light ? pixel(x, y) > 150 : pixel(x, y) < 110;
  let within = 0;
  let around = 0;
  const ring = 1;
  for (
    let y = Math.floor((box.y - ring) * toPixels);
    y <= Math.ceil((box.y + box.h + ring) * toPixels);
    y++
  ) {
    for (
      let x = Math.floor((box.x - ring) * toPixels);
      x <= Math.ceil((box.x + box.w + ring) * toPixels);
      x++
    ) {
      if (!ink(x, y)) continue;
      const inside =
        x >= box.x * toPixels &&
        x <= (box.x + box.w) * toPixels &&
        y >= box.y * toPixels &&
        y <= (box.y + box.h) * toPixels;
      if (inside) within++;
      else around++;
    }
  }
  return { within, around };
}
