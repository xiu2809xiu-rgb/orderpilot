import { beforeAll, describe, expect, it } from "vitest";
import { PAGE } from "./canvas.js";
import { DEMO_FILES } from "./demo.js";
import { scanPages } from "./scan.js";
import { stampOps, STAMP_BASELINE } from "./stamp.js";
import { generated, scanStem, type Generated } from "./testing/generated.js";
import { pageImage, textOrigins } from "./testing/pdf-reader.js";

let run: Generated;
beforeAll(async () => {
  run = await generated();
});

const bytesOf = (stem: string): Uint8Array => {
  const bytes = run.pdf.get(stem);
  if (!bytes) throw new Error(`No file ${stem}`);
  return bytes;
};

describe("the synthetic label on every demo file", () => {
  const readable = DEMO_FILES.filter((f) => !f.scanned);

  it.each(readable.map((f) => f.stem))(
    "is on every page of %s",
    async (stem) => {
      const pages = run.truth.get(stem)?.pageCount ?? 0;
      const labels = (await textOrigins(bytesOf(stem))).filter(
        (t) => Math.abs(t.y - STAMP_BASELINE) < 0.01 && t.x === 36,
      );
      expect(labels.map((t) => t.page)).toEqual(
        Array.from({ length: pages }, (_, i) => i + 1),
      );
    },
  );

  // The scan has no text to read the label from, so compare pixels: the dots
  // the label adds to an empty scan must also be dark in the real one.
  it("is in the pixels of the scan", async () => {
    const meta = { title: "t", subject: "s", keywords: [] };
    const empty = await scanPages([[]], meta);
    const labelled = await scanPages([stampOps(1, 1)], meta);
    const [bare, stamped, real] = await Promise.all([
      pageImage(empty.bytes),
      pageImage(labelled.bytes),
      pageImage(bytesOf(scanStem())),
    ]);
    if (!bare || !stamped || !real) throw new Error("A scan has no image");

    // Only the foot of the page, where the label sits and the body never does.
    const top = Math.floor(((STAMP_BASELINE - 12) / PAGE.height) * bare.height);
    let label = 0;
    let kept = 0;
    for (let i = top * bare.width; i < bare.pixels.length; i++) {
      if ((bare.pixels[i] ?? 0) - (stamped.pixels[i] ?? 0) > 60) {
        label++;
        if ((bare.pixels[i] ?? 0) - (real.pixels[i] ?? 0) > 40) kept++;
      }
    }
    expect(label).toBeGreaterThan(100);
    expect(kept / label).toBeGreaterThan(0.9);
  });
});
