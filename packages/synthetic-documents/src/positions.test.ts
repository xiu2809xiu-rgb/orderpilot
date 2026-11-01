import { beforeAll, describe, expect, it } from "vitest";
import type { PlacedField } from "./model.js";
import { pageImage, textOrigins } from "./testing/pdf-reader.js";
import { generated, type Generated } from "./testing/generated.js";

let run: Generated;
beforeAll(async () => {
  run = await generated();
});

/** A field's box in points, from the fractions the ground truth holds. */
function inPoints(field: PlacedField, page: { width: number; height: number }) {
  const [x, y, w, h] = field.box;
  return {
    x: x * page.width,
    y: y * page.height,
    w: w * page.width,
    h: h * page.height,
  };
}

describe("field positions", () => {
  it("puts every box on its page, with a size", () => {
    for (const truth of run.truth.values()) {
      for (const field of truth.fields) {
        const [x, y, w, h] = field.box;
        expect(field.page).toBeGreaterThanOrEqual(1);
        expect(field.page).toBeLessThanOrEqual(truth.pageCount);
        expect(w).toBeGreaterThan(0);
        expect(h).toBeGreaterThan(0);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(x + w).toBeLessThanOrEqual(1);
        expect(y + h).toBeLessThanOrEqual(1);
      }
    }
  });

  it("puts every box around the text the PDF really draws there", async () => {
    let checked = 0;
    for (const [stem, truth] of run.truth) {
      if (truth.readable !== "text") continue;
      const origins = await textOrigins(run.pdf.get(stem) ?? new Uint8Array());
      for (const field of truth.fields) {
        const box = inPoints(field, truth.page);
        // Each printed line starts inside the box, on its own baseline.
        const inside = origins.filter(
          (o) =>
            o.page === field.page &&
            o.x >= box.x - 0.01 &&
            o.x <= box.x + box.w &&
            o.y >= box.y - 0.01 &&
            o.y <= box.y + box.h,
        );
        expect(
          inside.length,
          `${stem} ${field.id} on page ${String(field.page)}`,
        ).toBeGreaterThanOrEqual(field.text.split("\n").length);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it("puts a scan's boxes around real ink in its image", async () => {
    const stem = "po-table-so-0120-scanned";
    const truth = run.truth.get(stem);
    const image = await pageImage(run.pdf.get(stem) ?? new Uint8Array());
    if (!truth || !image) throw new Error("The scan is missing");
    const toPixels = image.width / truth.page.width;
    const pixel = (x: number, y: number): number =>
      image.pixels[y * image.width + x] ?? 255;
    for (const field of truth.fields) {
      const box = inPoints(field, truth.page);
      // The shop's name is white on a dark band: look for light ink there.
      const onBand = field.key === "customerName";
      const ink = (x: number, y: number): boolean =>
        onBand ? pixel(x, y) > 150 : pixel(x, y) < 110;
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
      expect(within, `ink in ${field.id}`).toBeGreaterThan(8);
      if (!onBand) {
        // A row rule or a speck may touch the ring, but the text itself is inside.
        expect(around, `ink around ${field.id}`).toBeLessThan(within * 0.6);
      }
    }
  });
});
