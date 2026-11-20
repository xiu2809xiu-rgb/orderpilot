import { describe, expect, it } from "vitest";
import { demoPageImage, previewFor } from "./demoDocument";

describe("previewFor", () => {
  it("matches a known document by the file name without its extension, in any case", () => {
    expect(previewFor("po-4471-26.pdf")).toBe("po-4471-26");
    expect(previewFor("PO-4471-26.PDF")).toBe("po-4471-26");
    expect(previewFor("po-4471-26")).toBe("po-4471-26");
  });

  it("opens the default for an unknown name, no name, or a name that only starts the same", () => {
    expect(previewFor("customer-po.pdf")).toBe("po-boxed-so-0102");
    expect(previewFor("po-4471-26-copy.pdf")).toBe("po-boxed-so-0102");
    expect(previewFor("toString.pdf")).toBe("po-boxed-so-0102");
    expect(previewFor(null)).toBe("po-boxed-so-0102");
  });
});

describe("demoPageImage", () => {
  it("names the page image after the PDF it was made from", () => {
    expect(demoPageImage({ file: "po-4471-26.pdf" }, 1)).toBe(
      "/directions/po-4471-26-p1.png",
    );
  });
});
