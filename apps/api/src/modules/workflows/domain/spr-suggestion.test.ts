import { describe, expect, it } from "vitest";
import { SprSuggestion } from "./spr-suggestion.js";

const stock = { inventory: "20", qtyOnSalesOrder: "20", qtyOnPurchOrder: "22" };

describe("SprSuggestion", () => {
  it("works out available stock as Inventory minus Qty. on Sales Order plus Qty. on Purch. Order", () => {
    expect(SprSuggestion.availableStock(stock)).toBe("22.00");
    expect(
      SprSuggestion.availableStock({
        inventory: "10",
        qtyOnSalesOrder: "30",
        qtyOnPurchOrder: "0",
      }),
    ).toBe("-20.00");
  });

  it("suggests the shortfall, with the figures behind it", () => {
    const basis = SprSuggestion.fromShortfall({ ordered: "120", ...stock });
    expect(basis).toEqual({
      ordered: "120",
      ...stock,
      availableStock: "22.00",
      shortfall: "98.00",
    });
  });

  it("suggests nothing when the stock covers the order exactly or with room", () => {
    expect(SprSuggestion.fromShortfall({ ordered: "22", ...stock })).toBeNull();
    expect(SprSuggestion.fromShortfall({ ordered: "5", ...stock })).toBeNull();
  });

  it("counts a negative available stock into the shortfall", () => {
    const basis = SprSuggestion.fromShortfall({
      ordered: "10",
      inventory: "5",
      qtyOnSalesOrder: "15",
      qtyOnPurchOrder: "0",
    });
    expect(basis?.availableStock).toBe("-10.00");
    expect(basis?.shortfall).toBe("20.00");
  });
});
