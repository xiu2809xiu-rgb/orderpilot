import { describe, expect, it } from "vitest";
import { SALES_HISTORY, STOCK_ANSWER } from "../data/index";
import { classify } from "./useSparkChat";
import {
  grouped,
  millions,
  monthName,
  stockFacts,
  trendFacts,
} from "./sparkFacts";

describe("the stock figures", () => {
  it("name the one HP monitor and add its totals", () => {
    const facts = stockFacts();
    expect(facts.only?.itemNo).toBe("I-0025");
    expect(facts.totals).toEqual(STOCK_ANSWER.totals);
  });

  it("keep available equal to on hand, less sales orders, plus purchase orders", () => {
    const { totals } = stockFacts();
    expect(totals.available).toBe(
      totals.onHand - totals.onSalesOrders + totals.onPurchaseOrders,
    );
  });

  it("name no single item when the answer holds more than one", () => {
    const first = STOCK_ANSWER.items[0];
    if (!first) throw new Error("no item");
    const facts = stockFacts({
      ...STOCK_ANSWER,
      items: [first, { ...first, itemNo: "I-9999" }],
    });
    expect(facts.only).toBeNull();
  });
});

describe("the trend figures", () => {
  const facts = trendFacts();

  it("add the last 12 months and the 12 before, from the history", () => {
    const amounts = SALES_HISTORY.total.amountUsd;
    expect(facts.last12).toBeCloseTo(
      amounts.slice(-12).reduce((sum, value) => sum + value, 0),
      2,
    );
    expect(facts.prior12).toBeCloseTo(
      amounts.slice(-24, -12).reduce((sum, value) => sum + value, 0),
      2,
    );
    expect(facts.change).toBeCloseTo(
      (facts.last12 - facts.prior12) / facts.prior12,
      10,
    );
  });

  it("lay out 12 months seen and 6 forecast, in order, with a range on each forecast month", () => {
    expect(facts.points).toHaveLength(18);
    expect(facts.points.slice(0, 12).every((point) => !point.forecast)).toBe(
      true,
    );
    const ahead = facts.points.slice(12);
    expect(ahead.every((point) => point.forecast && point.range)).toBe(true);
    const months = facts.points.map((point) => point.month);
    expect([...months].sort()).toEqual(months);
    for (const point of ahead) {
      expect(point.range?.low).toBeLessThan(point.amountUsd);
      expect(point.range?.high).toBeGreaterThan(point.amountUsd);
    }
  });

  it("total the forecast months", () => {
    const sum = SALES_HISTORY.forecast.amountUsd.reduce(
      (total, point) => total + point.forecast,
      0,
    );
    expect(facts.forecastTotal).toBeCloseTo(sum, 2);
  });
});

describe("the number words", () => {
  it("name a month and group a number", () => {
    expect(monthName("2026-10")).toBe("Oct");
    expect(grouped(1020)).toBe("1,020");
    expect(millions(172_433_934.49)).toBe("172.4");
  });
});

describe("which scripted answer a question gets", () => {
  it("sends monitor and stock words to the stock answer", () => {
    expect(classify("How many HP monitors do we have?", false)).toBe("stock");
    expect(classify("what is our stock", true)).toBe("stock");
  });

  it("sends sales words to the trend answer, but only for a role that may read sales", () => {
    expect(classify("how are sales trending", true)).toBe("trend");
    expect(classify("how are sales trending", false)).toBe("other");
  });

  it("gives anything else the honest answer", () => {
    expect(classify("hello", true)).toBe("other");
  });
});
