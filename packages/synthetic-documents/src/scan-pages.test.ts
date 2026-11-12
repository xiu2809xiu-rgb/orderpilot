import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { beforeAll, describe, expect, it } from "vitest";
import { PAGE } from "./canvas.js";
import { contextFor } from "./context.js";
import { developed } from "./paper.js";
import { Raster } from "./raster.js";
import {
  renderDocument,
  renderResolved,
  type RenderedDocument,
} from "./render.js";
import { TILTS, scanPages, tiltOf } from "./scan.js";
import { STAMP_BASELINE } from "./stamp.js";
import { boxedPo } from "./testing/generated.js";
import { inkAround } from "./testing/ink.js";
import { drawn, longSubject } from "./testing/long.js";
import {
  pageImage,
  textOrigins,
  type GreyImage,
} from "./testing/pdf-reader.js";

const dataset = createSyntheticDataset();
const ctx = contextFor(dataset);
const PAGE_SIZE = { width: PAGE.width, height: PAGE.height };

describe("scans of more than one page", () => {
  const scans = new Map<string, RenderedDocument>();
  beforeAll(async () => {
    scans.set(
      "the boxed PO",
      await renderDocument(dataset, boxedPo().orderNo, "CUSTOMER_PO", {
        scanned: true,
      }),
    );
    scans.set(
      "a long boxed PO",
      await renderResolved(ctx, longSubject(ctx, "LS-0002"), "CUSTOMER_PO", {
        scanned: true,
      }),
    );
  });

  it("makes one image page for every page of the document, and no text", async () => {
    const expected = new Map([
      ["the boxed PO", 2],
      ["a long boxed PO", 3],
    ]);
    for (const [name, scan] of scans) {
      expect(scan.pageCount, name).toBe(expected.get(name));
      expect(await textOrigins(scan.bytes), name).toEqual([]);
      for (let page = 1; page <= scan.pageCount; page++) {
        const image = await pageImage(scan.bytes, page);
        expect(image, `${name} page ${String(page)}`).not.toBeNull();
      }
    }
  });

  it("puts every box on the ink of its own page, whatever the sheet's tilt", async () => {
    let onLaterPages = 0;
    for (const [name, scan] of scans) {
      for (const field of scan.fields) {
        const image = await pageImage(scan.bytes, field.page);
        if (!image) throw new Error("A scan page has no image");
        const { within, around } = inkAround(image, PAGE_SIZE, field.box);
        expect(within, `${name} ink in ${field.id}`).toBeGreaterThan(8);
        expect(around, `${name} ink around ${field.id}`).toBeLessThan(
          within * 0.6,
        );
        if (field.page > 1) onLaterPages++;
      }
    }
    // The test is empty unless later pages hold fields.
    expect(onLaterPages).toBeGreaterThan(20);
  });

  it("keeps every box at least 20 points inside the page after the tilt", () => {
    for (const [name, scan] of scans) {
      for (const field of scan.fields) {
        const [x, y, w, h] = field.box;
        expect(x * PAGE.width, `${name} ${field.id}`).toBeGreaterThanOrEqual(
          20,
        );
        expect(y * PAGE.height).toBeGreaterThanOrEqual(20);
        expect((x + w) * PAGE.width).toBeLessThanOrEqual(PAGE.width - 20);
        expect((y + h) * PAGE.height).toBeLessThanOrEqual(PAGE.height - 20);
      }
    }
  });

  it("has the label in the pixels of every page", async () => {
    const meta = { title: "t", subject: "s", keywords: [] };
    // Empty sheets at the same tilts, to tell the label from the backdrop.
    const bare = await scanPages([[], [], []], meta);
    // Pixels at the foot that are darker than the same sheet empty, where the
    // label sits and the body never does.
    const label = (image: GreyImage, empty: GreyImage): number => {
      const top = Math.floor(
        ((STAMP_BASELINE - 12) / PAGE.height) * image.height,
      );
      let count = 0;
      for (let i = top * image.width; i < image.pixels.length; i++) {
        if ((empty.pixels[i] ?? 0) - (image.pixels[i] ?? 0) > 40) count++;
      }
      return count;
    };
    for (const [name, scan] of scans) {
      for (let page = 1; page <= scan.pageCount; page++) {
        const [image, empty] = await Promise.all([
          pageImage(scan.bytes, page),
          pageImage(bare.bytes, page),
        ]);
        if (!image || !empty) throw new Error("A scan page has no image");
        expect(
          label(image, empty),
          `${name} page ${String(page)}`,
        ).toBeGreaterThan(100);
      }
    }
  });
});

describe("the sheets of a scan", () => {
  it("lie at four different angles that repeat, the first being today's", () => {
    expect(TILTS.map((t) => t.degrees)).toEqual([0.9, -0.5, 0.6, -0.3]);
    expect(TILTS[0]).toEqual({
      degrees: 0.9,
      cos: 0.99987663,
      sin: 0.01570732,
      shift: [5, 8],
    });
    expect(tiltOf(5)).toBe(tiltOf(1));
    expect(tiltOf(3).degrees).toBe(0.6);
  });

  it("have their written-out sines and cosines in step with their degrees", () => {
    for (const t of TILTS) {
      const radians = (t.degrees * Math.PI) / 180;
      expect(t.cos).toBeCloseTo(Math.cos(radians), 7);
      expect(t.sin).toBeCloseTo(Math.sin(radians), 7);
    }
  });

  it("keeps the first page of a longer scan the same pixels as the page scanned alone", async () => {
    const { canvas } = drawn(ctx, longSubject(ctx, "LS-0002"), "CUSTOMER_PO");
    const meta = { title: "t", subject: "s", keywords: [] };
    const all = await scanPages(canvas.pages, meta);
    const first = canvas.pages[0];
    if (!first) throw new Error("no page");
    const alone = await scanPages([first], meta);
    expect(all.pages).toBe(canvas.pages.length);
    expect(alone.pages).toBe(1);
    const [a, b] = await Promise.all([
      pageImage(all.bytes, 1),
      pageImage(alone.bytes, 1),
    ]);
    expect(
      Buffer.from(a?.pixels ?? []).equals(Buffer.from(b?.pixels ?? [])),
    ).toBe(true);
  });

  it("moves a box by the tilt of the page it is on", async () => {
    const meta = { title: "t", subject: "s", keywords: [] };
    const scan = await scanPages([[], []], meta);
    const box = { x: 100, y: 100, w: 50, h: 10 };
    const [one, two] = [scan.moveBox(box, 1), scan.moveBox(box, 2)];
    expect(scan.moveBox(box)).toEqual(one);
    expect(two.x).not.toBeCloseTo(one.x, 0);
  });

  it("grains each sheet differently, and sheet 0 as it has always been", () => {
    const paper = () => new Raster(64, 64, 0.14);
    const first = developed(paper());
    expect(developed(paper(), 0)).toEqual(first);
    expect(developed(paper(), 1)).not.toEqual(first);
  });
});
