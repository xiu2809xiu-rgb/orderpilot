import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as data from "../../../packages/synthetic-data/src/index.ts";
import {
  FILES,
  MIN_ORDERS,
  OUT_DIR,
  buildDirectionsData,
} from "./directions-data.mjs";

// The committed JSON must be exactly what the script writes from the data set.
// If this fails: build nothing by hand, run `node apps/web/scripts/directions-data.mjs`
// and commit the result.
const written = await buildDirectionsData(data);
const committed = (name) =>
  JSON.parse(readFileSync(path.join(OUT_DIR, name), "utf8"));

describe("the design preview's data files", () => {
  it.each(FILES)("%s is what the script writes", (name) => {
    expect(readFileSync(path.join(OUT_DIR, name), "utf8")).toBe(written[name]);
  });

  it.each(FILES)(
    "%s names the script and the data set's seed and date",
    (name) => {
      const { source } = committed(name);
      expect(source.script).toBe("apps/web/scripts/directions-data.mjs");
      expect(source.seed).toBe(data.DEFAULT_SEED);
      expect(source.referenceDate).toBe(data.AS_OF);
      expect(source.label).toBe("Synthetic demo data");
    },
  );

  describe("step-times.json", () => {
    const file = committed("step-times.json");

    it("lists nine steps of each flow, in order", () => {
      expect(file.sales.map((s) => s.position)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
      expect(file.purchase.map((s) => s.position)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8, 9,
      ]);
    });

    it("gives a measured step an ordered spread and enough orders behind it", () => {
      for (const step of [...file.sales, ...file.purchase].filter(
        (s) => s.measured,
      )) {
        expect(step.n, step.id).toBeGreaterThanOrEqual(MIN_ORDERS);
        expect(step.p25, step.id).toBeLessThanOrEqual(step.median);
        expect(step.median, step.id).toBeLessThanOrEqual(step.p75);
      }
    });

    it("gives a step that is left out no numbers and a reason", () => {
      const out = [...file.sales, ...file.purchase].filter((s) => !s.measured);
      expect(out.length).toBeGreaterThan(0);
      for (const step of out) {
        expect([step.median, step.p25, step.p75, step.unit], step.id).toEqual([
          null,
          null,
          null,
          null,
        ]);
        expect(step.note.length, step.id).toBeGreaterThan(20);
      }
    });

    it("measures the sales steps from the milestones, and no more than the data holds", () => {
      const measured = file.sales.filter((s) => s.measured).map((s) => s.id);
      expect(measured).toEqual([
        "poIn",
        "stock",
        "pi",
        "payment",
        "pack",
        "forwarder",
      ]);
    });

    it("times the PO to receipt span over the receipts of the history", () => {
      const [span] = file.purchaseSpans;
      expect(span.n).toBeGreaterThan(MIN_ORDERS);
      expect(span.byVendor.every((v) => v.n >= MIN_ORDERS)).toBe(true);
    });
  });

  describe("history.json", () => {
    const file = committed("history.json");

    it("holds 24 months, oldest first, and the brands add up to the total", () => {
      expect(file.months).toHaveLength(24);
      expect([...file.months].sort()).toEqual(file.months);
      file.total.amountUsd.forEach((total, at) => {
        const sum = file.brands.reduce((acc, b) => acc + b.amountUsd[at], 0);
        expect(sum).toBeCloseTo(total, 1);
      });
    });

    it("forecasts six months after the history by the method it names", () => {
      const { forecast, total, months } = file;
      expect(forecast.name).toBe("seasonal-naive");
      expect(forecast.method).toContain("Seasonal naive");
      expect(forecast.amountUsd).toHaveLength(6);
      forecast.amountUsd.forEach((point, i) => {
        expect(point.forecast).toBeCloseTo(
          total.amountUsd[months.length - 12 + i],
          2,
        );
        expect(point.low).toBeLessThanOrEqual(point.forecast);
        expect(point.high).toBeGreaterThanOrEqual(point.forecast);
      });
    });
  });

  describe("stock-answer.json", () => {
    const file = committed("stock-answer.json");

    it("lists only monitors of the brand asked about, with the stock formula applied", () => {
      expect(file.items.length).toBeGreaterThan(0);
      for (const item of file.items) {
        expect(item.description.toLowerCase()).toContain("monitor");
        expect(item.available).toBe(
          item.onHand - item.onSalesOrders + item.onPurchaseOrders,
        );
      }
      const sum = (key) => file.items.reduce((acc, i) => acc + i[key], 0);
      expect(file.totals).toEqual({
        onHand: sum("onHand"),
        onSalesOrders: sum("onSalesOrders"),
        onPurchaseOrders: sum("onPurchaseOrders"),
        available: sum("available"),
      });
    });
  });
});
