import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { beforeAll, describe, expect, it } from "vitest";
import { PAGE } from "./canvas.js";
import { renderDocument, type RenderedDocument } from "./render.js";
import { STAMP_BASELINE, STAMP_TEXT } from "./stamp.js";
import { readMetadata, textOrigins } from "./testing/pdf-reader.js";

const dataset = createSyntheticDataset();

describe("renderDocument", () => {
  let first: RenderedDocument;
  let again: RenderedDocument;
  beforeAll(async () => {
    first = await renderDocument(dataset, "SO-0115", "CUSTOMER_PO");
    again = await renderDocument(
      createSyntheticDataset(),
      "SO-0115",
      "CUSTOMER_PO",
    );
  });

  it("gives the same bytes for the same inputs", () => {
    expect(Buffer.from(first.bytes).equals(Buffer.from(again.bytes))).toBe(
      true,
    );
    expect(again.fields).toEqual(first.fields);
  });

  it("is a real PDF with every metadata date fixed", async () => {
    expect(Buffer.from(first.bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(await readMetadata(first.bytes)).toEqual({
      created: "2026-11-02T09:00:00.000Z",
      modified: "2026-11-02T09:00:00.000Z",
      producer: "OrderPilot synthetic-documents",
    });
  });

  it("embeds its fonts instead of relying on the viewer", () => {
    const text = Buffer.from(first.bytes).toString("latin1");
    expect(text).toContain("/FontFile2");
    expect(text).not.toContain("Helvetica");
    expect(text).toContain("OPDEMO-");
  });

  it("carries the synthetic label on every page", async () => {
    expect(first.pageCount).toBe(2);
    expect(STAMP_TEXT).toContain("Synthetic demo data");
    const stamps = (await textOrigins(first.bytes)).filter(
      (t) => Math.abs(t.y - STAMP_BASELINE) < 0.01 && t.x === 36,
    );
    expect(stamps.map((t) => t.page)).toEqual([1, 2]);
  });

  it("names the document and its order in the file's own metadata", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(first.bytes, { updateMetadata: false });
    expect(doc.getTitle()).toBe("Customer purchase order PO-IN-4898");
    expect(doc.getAuthor()).toBe("Synthetic demo data");
  });

  it("has a text layer, and a scan does not", async () => {
    expect((await textOrigins(first.bytes)).length).toBeGreaterThan(40);
    const scan = await renderDocument(dataset, "SO-0120", "CUSTOMER_PO", {
      scanned: true,
    });
    expect(await textOrigins(scan.bytes)).toEqual([]);
    expect(scan.pageCount).toBe(1);
  });

  it("keeps the number, the kind and the order out of a scan's metadata", async () => {
    const scan = await renderDocument(dataset, "SO-0120", "CUSTOMER_PO", {
      scanned: true,
    });
    const { PDFDocument } = await import("pdf-lib");
    const doc = await PDFDocument.load(scan.bytes, { updateMetadata: false });
    const metadata = [doc.getTitle(), doc.getSubject(), doc.getKeywords()]
      .join(" ")
      .toLowerCase();
    expect(metadata).toContain("synthetic demo data");
    for (const given of [scan.facts.number, "SO-0120", "CUSTOMER_PO", "po-"]) {
      expect(metadata).not.toContain(given.toLowerCase());
    }
    expect(doc.getAuthor()).toBe("Synthetic demo data");
  });

  it("refuses a scan of more than one page", async () => {
    await expect(
      renderDocument(dataset, "SO-0115", "CUSTOMER_PO", { scanned: true }),
    ).rejects.toThrow("A scan is one page");
  });

  it("refuses an order or a kind it does not know", async () => {
    await expect(
      renderDocument(dataset, "SO-9999", "CUSTOMER_PO"),
    ).rejects.toThrow("No order SO-9999");
    await expect(
      renderDocument(dataset, "SO-0115", "AWB" as never),
    ).rejects.toThrow(RangeError);
  });

  it("keeps every drawn thing on the page", () => {
    expect(PAGE.width).toBeCloseTo(595.28);
    for (const field of first.fields) {
      const [x, y, w, h] = field.box;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(1);
      expect(y + h).toBeLessThanOrEqual(1);
    }
  });
});
