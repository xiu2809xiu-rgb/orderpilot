import { describe, expect, it } from "vitest";
import { checkFile, MAX_BYTES, precheck, sniff } from "./uploadRules";

const bytes = (...values: number[]) => new Uint8Array(values);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04);
const TEXT = new TextEncoder().encode("item,qty\nA,1\n");

describe("what the first bytes say", () => {
  it("recognises each accepted type and plain text", () => {
    expect(sniff(PDF)).toBe("pdf");
    expect(sniff(PNG)).toBe("png");
    expect(sniff(JPEG)).toBe("jpeg");
    expect(sniff(ZIP)).toBe("xlsx");
    expect(sniff(TEXT)).toBe("text");
  });

  it("says nothing for binary it does not know", () => {
    expect(sniff(bytes(0x00, 0x01, 0x02))).toBeNull();
  });
});

describe("refusing a file by its name and size alone", () => {
  it("refuses a type that is not accepted", () => {
    expect(precheck("setup.exe", 100)).toBe("type");
    expect(precheck("notes", 100)).toBe("type");
  });

  it("refuses an empty file and one over the limit", () => {
    expect(precheck("a.pdf", 0)).toBe("empty");
    expect(precheck("a.pdf", MAX_BYTES + 1)).toBe("size");
    expect(precheck("a.pdf", MAX_BYTES)).toBeNull();
  });
});

describe("accepting a file only when name, size and content agree", () => {
  it("accepts a real PDF, PNG, JPEG, XLSX and CSV", () => {
    expect(checkFile("po.pdf", 10, PDF)).toEqual({ ok: true, kind: "pdf" });
    expect(checkFile("scan.png", 10, PNG)).toEqual({ ok: true, kind: "png" });
    expect(checkFile("scan.JPG", 10, JPEG)).toEqual({ ok: true, kind: "jpeg" });
    expect(checkFile("book.xlsx", 10, ZIP)).toEqual({ ok: true, kind: "xlsx" });
    expect(checkFile("lines.csv", 10, TEXT)).toEqual({ ok: true, kind: "csv" });
  });

  it("refuses a name that claims a type its content is not", () => {
    expect(checkFile("invoice.pdf", 10, TEXT)).toEqual({
      ok: false,
      reason: "disguised",
      claimed: "pdf",
    });
    expect(checkFile("photo.png", 10, PDF).ok).toBe(false);
    expect(checkFile("lines.csv", 10, PDF).ok).toBe(false);
  });
});
