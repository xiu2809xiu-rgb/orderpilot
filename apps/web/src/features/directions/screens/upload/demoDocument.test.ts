import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  demoPageImage,
  SAMPLE_SHOWN,
  sampleFor,
  type PreviewName,
} from "./demoDocument";

describe("sampleFor", () => {
  it("matches a known document by the file name without its extension, in any case", () => {
    expect(sampleFor("po-4471-26.pdf")).toBe("po-4471-26");
    expect(sampleFor("PO-4471-26.PDF")).toBe("po-4471-26");
    expect(sampleFor("po-4471-26")).toBe("po-4471-26");
    expect(sampleFor("po-boxed-so-0102.pdf")).toBe("po-boxed-so-0102");
  });

  it("has no sample for an unknown name or a name that only starts the same", () => {
    expect(sampleFor("customer-po.pdf")).toBeNull();
    expect(sampleFor("po-4471-26-copy.pdf")).toBeNull();
    expect(sampleFor("toString.pdf")).toBeNull();
    expect(sampleFor("po-4471-26.csv.png")).toBeNull();
  });
});

describe("how a sample is named at the file list", () => {
  it("shows the number printed on the document", () => {
    const folders: Record<PreviewName, string> = {
      "po-boxed-so-0102": "demo-documents",
      "po-4471-26": "directions",
    };
    for (const name of Object.keys(folders) as PreviewName[]) {
      const file = join(process.cwd(), "public", folders[name], `${name}.json`);
      const parsed = JSON.parse(readFileSync(file, "utf8")) as {
        documentNumber: string;
      };
      expect(SAMPLE_SHOWN[name].endsWith(parsed.documentNumber)).toBe(true);
    }
  });
});

describe("demoPageImage", () => {
  it("names the page image after the PDF it was made from", () => {
    expect(demoPageImage({ file: "po-4471-26.pdf" }, 1)).toBe(
      "/directions/po-4471-26-p1.png",
    );
  });
});
