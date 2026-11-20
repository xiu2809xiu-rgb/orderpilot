import { describe, expect, it } from "vitest";
import { closeNames, editDistance, nameSlips } from "./closeNames";

const CUSTOMERS = [
  { number: "C-0046", name: "Sagarun Trading Co" },
  { number: "C-0047", name: "Sagaran Imports" },
  { number: "C-0012", name: "Meridian Peripherals" },
  { number: "C-0013", name: "Harbour Digital" },
];

describe("editDistance", () => {
  it("counts a swap of neighbours as one slip", () => {
    expect(editDistance("meridain", "meridian")).toBe(1);
    expect(editDistance("sagaran", "sagarun")).toBe(1);
    expect(editDistance("abc", "abc")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });
});

describe("nameSlips", () => {
  it("finds one or two slips in a word of a name", () => {
    expect(nameSlips("Sagaran", "Sagarun Trading Co")).toBe(1);
    expect(nameSlips("Mer1dian", "Meridian Peripherals")).toBe(1);
    expect(nameSlips("Meridan Periphrals", "Meridian Peripherals")).toBe(2);
  });

  it("lets a word that is still being typed be close to the start of a word", () => {
    expect(nameSlips("Meridin Perip", "Meridian Peripherals")).not.toBeNull();
  });

  it("asks short words to match exactly, so a few letters match nothing by chance", () => {
    expect(nameSlips("abx", "abc Trading")).toBeNull();
    expect(nameSlips("0025", "HP Monitor 24-inch")).toBeNull();
  });

  it("is null for a name that is not close, and for nothing typed", () => {
    expect(nameSlips("Zanzibar", "Harbour Digital")).toBeNull();
    expect(nameSlips("  ", "Harbour Digital")).toBeNull();
  });
});

describe("closeNames", () => {
  it("lists the closest names first and leaves out those already found", () => {
    const found = closeNames("Sagaran", CUSTOMERS, {
      exclude: new Set(["C-0047"]),
    });
    expect(found.map((c) => c.number)).toEqual(["C-0046"]);
  });

  it("finds Meridian for Mer1dian and nothing for an unrelated word", () => {
    expect(closeNames("Mer1dian", CUSTOMERS).map((c) => c.number)).toEqual([
      "C-0012",
    ]);
    expect(closeNames("Zanzibar", CUSTOMERS)).toEqual([]);
  });

  it("is limited", () => {
    const many = Array.from({ length: 9 }, (_, n) => ({
      number: `C-${String(n)}`,
      name: `Sagarun ${String(n)}`,
    }));
    expect(closeNames("Sagaran", many, { limit: 3 })).toHaveLength(3);
  });
});
