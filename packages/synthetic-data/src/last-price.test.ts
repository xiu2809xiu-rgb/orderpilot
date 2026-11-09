import { describe, expect, it } from "vitest";
import { DEFAULT_SEED, createSyntheticDataset } from "./index.js";
import { agreedPrice } from "./last-price.js";

describe("the customer's agreed price", () => {
  const data = createSyntheticDataset();
  const customer = (no: string) => {
    const found = data.customers.find((c) => c.no === no);
    if (!found) throw new Error(no);
    return found;
  };
  const item = (no: string) => {
    const found = data.items.find((i) => i.no === no);
    if (!found) throw new Error(no);
    return found;
  };

  it("prices every live line at the customer's agreed price, not the catalogue price", () => {
    let differing = 0;
    for (const order of data.orders) {
      const buyer = customer(order.header.sellToCustomerNo);
      for (const line of order.lines) {
        const bought = item(line.no);
        expect(line.unitPrice, `${order.header.no} ${line.no}`).toBe(
          agreedPrice(DEFAULT_SEED, buyer, bought),
        );
        if (line.unitPrice !== bought.unitPrice) differing++;
      }
    }
    expect(differing).toBeGreaterThan(100);
  });

  it("gives one item different prices to different customers", () => {
    const bought = item("I-0001");
    const prices = new Set(
      data.customers.map((c) => agreedPrice(DEFAULT_SEED, c, bought)),
    );
    expect(prices.size).toBeGreaterThan(20);
  });

  it("keeps a price near the catalogue price and over cost", () => {
    for (const c of data.customers) {
      for (const i of data.items.slice(0, 60)) {
        const price = Number(agreedPrice(DEFAULT_SEED, c, i));
        expect(price).toBeGreaterThanOrEqual(Number(i.unitCost) * 1.05 - 0.01);
        expect(price).toBeLessThan(Number(i.unitPrice) * 1.07);
        expect(price).toBeGreaterThan(Number(i.unitPrice) * 0.9);
      }
    }
  });

  it("does not depend on the reference date", () => {
    const later = createSyntheticDataset({ referenceDate: "2027-03-01" });
    const bought = item("I-0007");
    const buyer = customer("C-0003");
    expect(agreedPrice(DEFAULT_SEED, buyer, bought)).toBe(
      agreedPrice(DEFAULT_SEED, buyer, later.items[6] ?? bought),
    );
  });

  it("lets prepaying customers pay a little less than customers on credit", () => {
    const bought = item("I-0010");
    const mean = (prepay: boolean): number => {
      const group = data.customers.filter(
        (c) =>
          c.paymentTermsCode in
            { PREPAID: 1, "50% ADVANCE": 1, "30% DEPOSIT": 1 } ===
          prepay,
      );
      return (
        group.reduce(
          (s, c) => s + Number(agreedPrice(DEFAULT_SEED, c, bought)),
          0,
        ) / group.length
      );
    };
    expect(mean(true)).toBeLessThan(mean(false));
  });
});
