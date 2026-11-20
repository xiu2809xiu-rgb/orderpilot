import { describe, expect, it } from "vitest";
import {
  countryNameOf,
  customerSearchFields,
  itemSearchFields,
  matches,
} from "./search.js";

const item = {
  no: "I-0001",
  description: "Dell Notebook 14-inch",
  partNumber: "210-ZZ0001",
  brand: "Dell",
  category: "PCS",
  baseUnitOfMeasure: "PCS",
  unitPrice: "1.00",
  unitCost: "1.00",
  inventory: "1",
  qtyOnSalesOrder: "0",
  qtyOnPurchOrder: "0",
  vendorNo: "V-0001",
  vendorItemNo: "DEL-0100",
} as const;

const customer = {
  no: "C-1042",
  name: "Colombo Digital Traders",
  countryRegionCode: "LK",
  currencyCode: "USD",
  paymentTermsCode: "30 DAYS",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  taxRegistrationNumber: "",
  creditLimitLcy: "0.00",
  balanceLcy: "0.00",
} as const;

describe("what a search looks in", () => {
  it("finds an item by its vendor's number, its name and its own number for it", () => {
    const fields = itemSearchFields(item, "Halvorn Components Ltd");
    expect(matches("halvorn", fields)).toBe(true);
    expect(matches("V-0001", fields)).toBe(true);
    expect(matches("DEL-0100", fields)).toBe(true);
    expect(matches("Pelagia", fields)).toBe(false);
  });

  it("still finds an item by number, description and part number", () => {
    const fields = itemSearchFields(item, "Halvorn Components Ltd");
    for (const search of ["i-0001", "notebook 14", "210-zz0001"]) {
      expect(matches(search, fields)).toBe(true);
    }
  });

  it("finds a customer by its country's name and by its code", () => {
    const fields = customerSearchFields(customer);
    expect(matches("Sri Lanka", fields)).toBe(true);
    expect(matches("lk", fields)).toBe(true);
    expect(matches("India", fields)).toBe(false);
  });

  it("finds a code only whole, so that a short search is not noise", () => {
    const fields = { text: ["Zeta Works"], codes: ["LK"] };
    expect(matches("lk", fields)).toBe(true);
    expect(matches("l", fields)).toBe(false);
  });

  it("matches everything when the search is empty or blank", () => {
    expect(matches(undefined, { text: [] })).toBe(true);
    expect(matches("   ", { text: ["x"] })).toBe(true);
  });

  it("names a country, and gives back a code it does not know", () => {
    expect(countryNameOf("LK")).toBe("Sri Lanka");
    expect(countryNameOf("not a code")).toBe("not a code");
  });
});
