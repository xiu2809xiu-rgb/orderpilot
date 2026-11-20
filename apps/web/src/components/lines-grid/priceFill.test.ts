import { describe, expect, it } from "vitest";
import {
  listPrice,
  priceForCustomer,
  priceForPick,
  typedPrice,
} from "./priceFill";
import type { LastPrice, LineValue } from "./types";

const AGREED: LastPrice = {
  price: "17.9",
  agreedOn: "2026-10-14",
  documentNo: "SO-0007",
};
const line = (over: Partial<LineValue> = {}): LineValue => ({
  lineId: "a",
  item: { number: "I-0025", name: "HP Monitor 24-inch" },
  description: "",
  quantity: "1",
  unitPrice: "",
  unit: "",
  availableStock: null,
  ...over,
});

describe("listPrice", () => {
  it("is the item's price with two decimals, and empty when masked or missing", () => {
    expect(listPrice({ masked: false, value: "189" })).toBe("189.00");
    expect(listPrice({ masked: true, value: null })).toBe("");
    expect(listPrice({ masked: true, value: "189.00" })).toBe("");
    expect(listPrice({ masked: false, value: null })).toBe("");
    expect(listPrice(undefined)).toBe("");
  });
});

describe("priceForPick", () => {
  it("starts a line at the list price and remembers it", () => {
    expect(priceForPick(line(), "I-0025", "189.00")).toEqual({
      unitPrice: "189.00",
      priceFrom: { source: "item", itemNo: "I-0025", list: "189.00" },
    });
  });

  it("never takes back a price typed for the same item", () => {
    const typed = line({
      unitPrice: "150.00",
      priceFrom: { source: "typed", itemNo: "I-0025", list: "189.00" },
    });
    expect(priceForPick(typed, "I-0025", "189.00")).toEqual({
      unitPrice: "150.00",
      priceFrom: { source: "typed", itemNo: "I-0025", list: "189.00" },
    });
  });

  it("keeps a price typed before any item, and replaces one typed for another item", () => {
    const early = line({
      unitPrice: "150.00",
      priceFrom: { source: "typed", itemNo: "", list: "" },
    });
    expect(priceForPick(early, "I-0025", "189.00")).toEqual({
      unitPrice: "150.00",
      priceFrom: { source: "typed", itemNo: "I-0025", list: "189.00" },
    });
    const other = line({
      priceFrom: { source: "typed", itemNo: "I-0001", list: "9.00" },
    });
    expect(priceForPick(other, "I-0025", "189.00").unitPrice).toBe("189.00");
  });
});

describe("typedPrice", () => {
  it("marks the price as the person's, for the item on the line", () => {
    expect(
      typedPrice(
        line({
          priceFrom: { source: "item", itemNo: "I-0025", list: "189.00" },
        }),
      ),
    ).toEqual({ source: "typed", itemNo: "I-0025", list: "189.00" });
    expect(typedPrice(line({ item: null }))).toEqual({
      source: "typed",
      itemNo: "",
      list: "",
    });
  });
});

describe("priceForCustomer", () => {
  const filled = line({
    unitPrice: "189.00",
    priceFrom: { source: "item", itemNo: "I-0025", list: "189.00" },
  });

  it("prefers what the customer last agreed to the list price", () => {
    expect(priceForCustomer(filled, AGREED)).toEqual({
      unitPrice: "17.90",
      priceFrom: { source: "agreed", itemNo: "I-0025", list: "189.00" },
    });
  });

  it("leaves a price the person typed, and a saved line that has no source", () => {
    const typed = line({
      unitPrice: "150.00",
      priceFrom: { source: "typed", itemNo: "I-0025", list: "189.00" },
    });
    expect(priceForCustomer(typed, AGREED)).toBeNull();
    expect(priceForCustomer(line({ unitPrice: "20.00" }), AGREED)).toBeNull();
  });

  it("does nothing for a price that is already the agreed one", () => {
    const done = line({
      unitPrice: "17.90",
      priceFrom: { source: "agreed", itemNo: "I-0025", list: "189.00" },
    });
    expect(priceForCustomer(done, AGREED)).toBeNull();
  });

  it("goes back to the list price for a customer with none, but not when the lookup failed", () => {
    const agreed = line({
      unitPrice: "17.90",
      priceFrom: { source: "agreed", itemNo: "I-0025", list: "189.00" },
    });
    expect(priceForCustomer(agreed, "none")).toEqual({
      unitPrice: "189.00",
      priceFrom: { source: "item", itemNo: "I-0025", list: "189.00" },
    });
    expect(priceForCustomer(agreed, "unknown")).toBeNull();
    expect(priceForCustomer(filled, "none")).toBeNull();
  });

  it("ignores a price filled for an item that is no longer on the line", () => {
    const moved = line({
      item: { number: "I-0001", name: "Other" },
      unitPrice: "189.00",
      priceFrom: { source: "item", itemNo: "I-0025", list: "189.00" },
    });
    expect(priceForCustomer(moved, AGREED)).toBeNull();
  });
});
