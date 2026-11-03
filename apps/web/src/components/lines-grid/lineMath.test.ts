import { describe, expect, it } from "vitest";
import { amountOfLine, readLines, shortfallOfLine, totalsOf } from "./lineMath";
import { trackTemplate, editableKinds } from "./lineValues";

const MASK = { reason: "price", visibleTo: "Finance" } as const;

describe("line maths", () => {
  it("reads a form's lines without trusting them", () => {
    expect(readLines("nope")).toEqual([]);
    expect(readLines([null, { quantity: 4, item: "x" }])).toEqual([
      {},
      {
        lineId: "",
        item: null,
        quantity: "",
        unitPrice: "",
        availableStock: null,
      },
    ]);
  });

  it("works an amount from decimal strings", () => {
    expect(amountOfLine({ quantity: "3", unitPrice: "19.99" })).toBe("59.97");
    expect(amountOfLine({ quantity: "3", unitPrice: "" })).toBeNull();
  });

  it("totals the lines it can, and masks a total that would reveal a price", () => {
    const lines = [
      { quantity: "3", unitPrice: "19.99" },
      { quantity: "12", unitPrice: "24.90" },
      { quantity: "2.", unitPrice: "1.00" },
      { quantity: "5", unitPrice: "" },
    ];
    expect(totalsOf(lines, { hasAmount: true, masked: null })).toMatchObject({
      lineCount: 4,
      quantity: "20.00",
      amount: "358.77",
      masked: null,
    });
    const masked = totalsOf(lines, { hasAmount: true, masked: MASK });
    expect(masked.amount).toBeNull();
    expect(masked.masked).toEqual(MASK);
    // A grid with no amount column has nothing to hide, and nothing to total.
    expect(totalsOf(lines, { hasAmount: false, masked: MASK })).toMatchObject({
      amount: null,
      masked: null,
    });
  });

  it("finds a shortfall only for a chosen item with a known stock", () => {
    const base = {
      lineId: "L1",
      item: { number: "I-0002", name: "Keyboard" },
      quantity: "12",
      availableStock: "8",
    };
    expect(shortfallOfLine(base, 3)).toEqual({
      index: 3,
      lineId: "L1",
      itemNo: "I-0002",
      needed: "12",
      available: "8",
      shortBy: "4.00",
    });
    expect(shortfallOfLine({ ...base, availableStock: null }, 0)).toBeNull();
    expect(shortfallOfLine({ ...base, item: null }, 0)).toBeNull();
    expect(shortfallOfLine({ ...base, quantity: "8" }, 0)).toBeNull();
  });
});

describe("a screen's column declaration", () => {
  const order = [
    { kind: "lineNo", header: "Line" },
    { kind: "item", header: "Item" },
    { kind: "description", header: "Description", readOnly: true },
    { kind: "quantity", header: "Quantity" },
    { kind: "unitPrice", header: "Unit price", width: "8rem" },
    { kind: "remove", header: "Remove" },
  ] as const;

  it("lists what a person types in, in order, leaving out what they cannot", () => {
    expect(editableKinds(order, { priceMasked: false })).toEqual([
      "item",
      "quantity",
      "unitPrice",
    ]);
    expect(editableKinds(order, { priceMasked: true })).toEqual([
      "item",
      "quantity",
    ]);
  });

  it("gives each column its own width, or the kind's default", () => {
    expect(trackTemplate(order)).toBe(
      "2.75rem minmax(0, 2fr) minmax(0, 2fr) 5.5rem 8rem 2.75rem",
    );
  });

  it("tightens only the default widths for a tablet in landscape", () => {
    expect(trackTemplate(order, true)).toBe(
      "2.25rem minmax(0, 2fr) minmax(0, 1fr) 5rem 8rem 2.75rem",
    );
  });
});
