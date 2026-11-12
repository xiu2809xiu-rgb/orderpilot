import { describe, expect, it } from "vitest";
import {
  COUNTRY_CODES,
  COUNTRY_NAMES,
  addressOf,
  createSyntheticDataset,
  taxIdLength,
  taxIdOf,
} from "./index.js";

const data = createSyntheticDataset();

/** Edit distance, so a look-alike name can be found. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j] ?? 0;
      row[j] = Math.min(
        above + 1,
        (row[j - 1] ?? 0) + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return row[b.length] ?? 0;
}

describe("the customers in eleven countries", () => {
  it("has eleven countries, each with at least four customers and one live order", () => {
    expect(COUNTRY_CODES).toHaveLength(11);
    for (const country of COUNTRY_CODES) {
      expect(COUNTRY_NAMES[country]).toBeTruthy();
      const own = data.customers.filter((c) => c.countryRegionCode === country);
      expect(own.length, country).toBeGreaterThanOrEqual(4);
      const nos = new Set(own.map((c) => c.no));
      expect(
        data.orders.filter((o) => nos.has(o.header.sellToCustomerNo)).length,
        country,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives each new country two live orders, and a prepaying customer when awaiting payment", () => {
    const later = new Map(
      data.customers.slice(40).map((c) => [c.no, c] as const),
    );
    const perCountry = new Map<string, number>();
    for (const order of data.orders) {
      const customer = later.get(order.header.sellToCustomerNo);
      if (!customer) continue;
      perCountry.set(
        customer.countryRegionCode,
        (perCountry.get(customer.countryRegionCode) ?? 0) + 1,
      );
      if (order.sampleScreenState === "sample-awaiting-payment") {
        expect(order.header.prepaymentPercent, order.header.no).not.toBe("0");
      }
    }
    expect([...perCountry.entries()].sort()).toEqual([
      ["ID", 2],
      ["MV", 2],
      ["MY", 2],
      ["NP", 2],
      ["SG", 2],
      ["VN", 2],
    ]);
  });

  it("gives every customer an address in a real city and a fake tax number of the right length", () => {
    for (const customer of data.customers) {
      expect(customer.addressLine1, customer.no).toMatch(/^\d+ \S/);
      expect(customer.city).toBeTruthy();
      expect(customer.state).toBeTruthy();
      expect(customer.postalCode).toBeTruthy();
      const tax = customer.taxRegistrationNumber;
      expect(tax, customer.no).toHaveLength(
        taxIdLength(customer.countryRegionCode),
      );
      expect(tax.startsWith(`${customer.countryRegionCode}ZZ`)).toBe(true);
      expect(tax).toMatch(/0{2,}\d{4}$/);
    }
    const taxes = data.customers.map((c) => c.taxRegistrationNumber);
    expect(new Set(taxes).size).toBe(64);
  });

  it("keeps an address and a tax number the same for the same customer number", () => {
    expect(addressOf(7, "IN")).toEqual(addressOf(7, "IN"));
    expect(taxIdOf(7, "IN")).toBe(taxIdOf(7, "IN"));
    expect(taxIdOf(7, "IN")).not.toBe(taxIdOf(8, "IN"));
  });

  it("has exactly two pairs of names one letter apart, each with its own tax number", () => {
    const pairs: [string, string][] = [];
    for (const [i, a] of data.customers.entries()) {
      for (const b of data.customers.slice(i + 1)) {
        if (distance(a.name, b.name) === 1) pairs.push([a.no, b.no]);
      }
    }
    expect(pairs).toHaveLength(2);
    for (const [a, b] of pairs) {
      const first = data.customers.find((c) => c.no === a);
      const second = data.customers.find((c) => c.no === b);
      expect(first?.taxRegistrationNumber).not.toBe(
        second?.taxRegistrationNumber,
      );
    }
  });

  it("has no price group on any customer", () => {
    for (const customer of data.customers) {
      expect(Object.keys(customer)).not.toContain("customerPriceGroup");
    }
  });

  it("ships each order to its customer's own address", () => {
    for (const order of data.orders) {
      const customer = data.customers.find(
        (c) => c.no === order.header.sellToCustomerNo,
      );
      expect(order.shipTo).toEqual({
        name: customer?.name,
        addressLine1: customer?.addressLine1,
        addressLine2: customer?.addressLine2,
        city: customer?.city,
        postalCode: customer?.postalCode,
        countryRegionCode: customer?.countryRegionCode,
      });
    }
  });
});
