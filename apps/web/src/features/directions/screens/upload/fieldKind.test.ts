import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkEdit, fieldKind } from "./fieldKind";

describe("the kind of a field, from its key", () => {
  it("reads the last part of the key", () => {
    expect(fieldKind("lines.quantity")).toBe("quantity");
    expect(fieldKind("totalQuantity")).toBe("quantity");
    expect(fieldKind("lines.unitPrice")).toBe("price");
    expect(fieldKind("total")).toBe("price");
    expect(fieldKind("requiredDate")).toBe("date");
    expect(fieldKind("validUntil")).toBe("date");
    expect(fieldKind("customerName")).toBe("text");
    expect(fieldKind("currency")).toBe("text");
  });

  it("gives every key of the synthetic documents a kind that fits its printed value", () => {
    const folder = join(process.cwd(), "public", "demo-documents");
    const files = readdirSync(folder).filter((name) => name.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const name of files) {
      const parsed: unknown = JSON.parse(
        readFileSync(join(folder, name), "utf8"),
      );
      const fields =
        typeof parsed === "object" && parsed !== null && "fields" in parsed
          ? (parsed.fields as { key: string; text: string }[])
          : [];
      for (const field of fields) {
        // What the document printed must pass the check for its own kind.
        expect(
          checkEdit(field.key, field.text),
          `${name} ${field.key}`,
        ).toEqual({ ok: true, text: field.text.trim() });
      }
    }
  });
});

describe("checking an edit", () => {
  it("refuses a blank edit for every kind", () => {
    for (const key of ["lines.quantity", "total", "poDate", "customerName"]) {
      expect(checkEdit(key, "   ")).toEqual({ ok: false, reason: "blank" });
    }
  });

  it("takes a quantity that is a whole or decimal number above zero", () => {
    expect(checkEdit("lines.quantity", " 1,200 ")).toEqual({
      ok: true,
      text: "1,200",
    });
    expect(checkEdit("lines.quantity", "2.5")).toEqual({
      ok: true,
      text: "2.5",
    });
    for (const bad of ["abc", "0", "0.0", "-3", "1,20", "1e3", "12 pcs"]) {
      expect(checkEdit("lines.quantity", bad), bad).toEqual({
        ok: false,
        reason: "quantity",
      });
    }
  });

  it("takes a price that is a number of money, zero included", () => {
    expect(checkEdit("lines.unitPrice", "61.20").ok).toBe(true);
    expect(checkEdit("balanceDue", "0.00").ok).toBe(true);
    expect(checkEdit("total", "61,200.00").ok).toBe(true);
    for (const bad of ["USD 5", "5.123", "-1.00", "twelve"]) {
      expect(checkEdit("total", bad), bad).toEqual({
        ok: false,
        reason: "price",
      });
    }
  });

  it("takes a real date and refuses one that is not on the calendar", () => {
    expect(checkEdit("poDate", "11 Nov 2026").ok).toBe(true);
    expect(checkEdit("poDate", "2026-11-11").ok).toBe(true);
    expect(checkEdit("poDate", "29 Feb 2028").ok).toBe(true);
    for (const bad of [
      "31 Feb 2026",
      "29 Feb 2027",
      "11 Nox 2026",
      "next week",
      "2026-13-01",
    ]) {
      expect(checkEdit("poDate", bad), bad).toEqual({
        ok: false,
        reason: "date",
      });
    }
  });

  it("takes any text for a field of no special kind, trimmed", () => {
    expect(checkEdit("customerName", "  Acme  ")).toEqual({
      ok: true,
      text: "Acme",
    });
  });
});
