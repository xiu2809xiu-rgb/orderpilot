import { poVersionDifferencesSchema } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { OrderMasking } from "./order-masking.js";
import type { NumberedPoVersionContent } from "./po-version-content.js";
import { toDifferencesView } from "./po-version-view.js";

const masking = new OrderMasking();

const content = (
  poVersionNo: number,
  quantity: string,
  unitPrice: string,
): NumberedPoVersionContent => ({
  poVersionNo,
  orderDate: "2026-11-08",
  shipmentDate: null,
  currencyCode: "USD",
  prepaymentPercent: "30.00",
  lines: [
    {
      lineNo: 1,
      itemNo: "I-0001",
      description: "Synthetic demo item",
      quantity,
      unitPrice,
      qtyToShip: quantity,
    },
  ],
});

const PRICE_KEYS = ["classification", "field", "masked", "reason"];

describe("toDifferencesView", () => {
  it("a masked price difference has no from, to or changed key", () => {
    const view = toDifferencesView(
      content(1, "229.000", "31.97"),
      content(2, "230.000", "33.41"),
      masking,
      "WAREHOUSE",
    );
    // The parsed copy is what the web app reads: it must hold no price either.
    const parsed = poVersionDifferencesSchema.parse(view);
    expect(Object.keys(parsed.total).sort()).toEqual(PRICE_KEYS);
    for (const line of parsed.lines)
      expect(Object.keys(line.unitPrice).sort()).toEqual(PRICE_KEYS);
    const text = JSON.stringify(view);
    for (const price of ["31.97", "33.41", "7321.13", "7684.30"])
      expect(text).not.toContain(price);
    expect(view.pricesCompared).toBe(false);
    // The quantity is not a price: it is shown.
    expect(view.lines[0]?.quantity).toEqual({
      from: "229.000",
      to: "230.000",
      changed: true,
    });
  });

  it("a masked role's line status ignores price", () => {
    const priceOnly = toDifferencesView(
      content(1, "229.000", "31.97"),
      content(2, "229.000", "33.41"),
      masking,
      "LOGISTICS",
    );
    const nothing = toDifferencesView(
      content(1, "229.000", "31.97"),
      content(2, "229.000", "31.97"),
      masking,
      "LOGISTICS",
    );
    expect(priceOnly.lines[0]?.status).toBe("unchanged");
    expect(priceOnly.identical).toBe(true);
    // A price-only revision must not be told apart from no change at all.
    expect(JSON.stringify(priceOnly)).toBe(JSON.stringify(nothing));
  });

  it("builds its own diff, whatever the caller holds", () => {
    // It takes two contents and a role, so there is no diff to hand it.
    expect(toDifferencesView.length).toBe(4);
    const from = content(1, "229.000", "31.97");
    const to = content(2, "229.000", "33.41");
    const sees = toDifferencesView(from, to, masking, "SUPPORT");
    const hidden = toDifferencesView(from, to, masking, "WAREHOUSE");
    expect(sees.pricesCompared).toBe(true);
    expect(sees.lines[0]).toMatchObject({
      status: "changed",
      unitPrice: { masked: false, from: "31.97", to: "33.41", changed: true },
    });
    expect(sees.total).toMatchObject({ masked: false, changed: true });
    expect(hidden.pricesCompared).toBe(false);
    expect(hidden.lines[0]?.status).toBe("unchanged");
  });
});
