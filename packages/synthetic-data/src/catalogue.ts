import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import type { SeededRandom } from "./random.js";
import type {
  Customer,
  Item,
  OpeningBalances,
  Vendor,
  VendorBankAccount,
} from "./types.js";

// Every name below is invented. Nothing is taken from a real company, brand or
// person. The numbers around them come from the seeded generator.

const CUSTOMERS = [
  {
    name: "Quillon Harbour Traders",
    country: "IN",
    terms: "30 DAYS",
    group: "DIST-A",
  },
  {
    name: "Brindle Coast Imports",
    country: "LK",
    terms: "PREPAID",
    group: "DIST-B",
  },
  {
    name: "Tamarell Palm Wholesale",
    country: "BD",
    terms: "LC AT SIGHT",
    group: "DIST-B",
  },
  {
    name: "Verrick Bazaar Distribution",
    country: "PK",
    terms: "50% ADVANCE",
    group: "RETAIL",
  },
  {
    name: "Ostrel Ridge Trading",
    country: "AE",
    terms: "30 DAYS",
    group: "DIST-A",
  },
] as const;

const VENDORS = [
  { name: "Halvorn Components Ltd", terms: "30 DAYS" },
  { name: "Pelagia Source Co", terms: "60 DAYS" },
  { name: "Quenby Origin Works", terms: "PREPAID" },
] as const;

const BRANDS = [
  "Norvale",
  "Kelmora",
  "Tessaro",
  "Brindlewick",
  "Ashgrove",
  "Vantora",
] as const;

const PRODUCTS = [
  { name: "Wireless Mouse", price: [14, 22], cost: 0.55 },
  { name: "USB-C Cable 1 m", price: [4, 8], cost: 0.45 },
  { name: "Power Bank 10000 mAh", price: [18, 30], cost: 0.6 },
  { name: "LED Desk Lamp", price: [12, 25], cost: 0.5 },
  { name: "Bluetooth Speaker", price: [20, 45], cost: 0.58 },
] as const;

/** The item whose stock is set low on purpose, so one sample order is short. */
export const SHORT_STOCK_ITEM_INDEX = 7;

const pad = (n: number, width = 4): string => String(n).padStart(width, "0");

export function makeCustomers(random: SeededRandom): Customer[] {
  return CUSTOMERS.map((c, i) => {
    const limit = random.int(20, 80) * 1_000;
    return {
      no: `C-${pad(i + 1)}`,
      name: c.name,
      countryRegionCode: c.country,
      currencyCode: "USD",
      paymentTermsCode: c.terms,
      customerPriceGroup: c.group,
      creditLimitLcy: `${String(limit)}.00`,
      balanceLcy: random.money(0, Math.floor(limit / 2)),
    };
  });
}

export function makeVendors(random: SeededRandom): Vendor[] {
  return VENDORS.map((v, i) => ({
    no: `V-${pad(i + 1)}`,
    name: v.name,
    currencyCode: "USD",
    paymentTermsCode: v.terms,
    balanceLcy: random.money(0, 40_000),
  }));
}

/** Fake on purpose: ZZ is not a country, and the bank names itself a demo. */
export function makeVendorBankAccounts(
  vendors: readonly Vendor[],
): VendorBankAccount[] {
  return vendors.map((v, i) => ({
    vendorNo: v.no,
    code: "MAIN",
    name: "Demo Bank (not a real bank)",
    bankAccountNo: `0000000000${pad(i + 1, 2)}`,
    swiftCode: "DEMOZZ00",
    iban: `ZZ00DEMO00000000000${pad(i + 1, 2)}`,
  }));
}

export function makeItems(
  random: SeededRandom,
  vendors: readonly Vendor[],
): Item[] {
  const items: Item[] = [];
  for (const [b, brand] of BRANDS.entries()) {
    for (const [p, product] of PRODUCTS.entries()) {
      const index = items.length;
      const vendor = vendors[(b + p) % vendors.length];
      if (!vendor) throw new Error("Items need at least one vendor");
      const price = random.money(product.price[0], product.price[1]);
      const cost = (Number(price) * product.cost).toFixed(2);
      items.push({
        no: `I-${pad(index + 1)}`,
        description: `${brand} ${product.name}`,
        brand,
        baseUnitOfMeasure: "PCS",
        unitPrice: price,
        unitCost: cost,
        inventory:
          index === SHORT_STOCK_ITEM_INDEX
            ? "20"
            : String(random.int(150, 900)),
        qtyOnSalesOrder: String(random.int(0, 60)),
        qtyOnPurchOrder: String(random.int(0, 400)),
        vendorNo: vendor.no,
        vendorItemNo: `${brand.slice(0, 3).toUpperCase()}-${pad(index + 100)}`,
      });
    }
  }
  return items;
}

export function openingBalances(
  customers: readonly Customer[],
  vendors: readonly Vendor[],
  items: readonly Item[],
): OpeningBalances {
  const sum = (values: readonly string[]): string =>
    values.reduce((total, value) => addDecimal(total, value), "0.00");
  return {
    receivablesLcy: sum(customers.map((c) => c.balanceLcy)),
    payablesLcy: sum(vendors.map((v) => v.balanceLcy)),
    stockValueLcy: sum(
      items.map((i) => multiplyDecimal(i.inventory, i.unitCost)),
    ),
  };
}
