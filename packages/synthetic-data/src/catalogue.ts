import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import {
  BRANDS,
  CUSTOMER_NAMES,
  PAYMENT_TERMS,
  PRICE_GROUPS,
  PRODUCTS,
  TEAM,
  VARIANTS,
  VENDOR_NAMES,
} from "./names.js";
import type { SeededRandom } from "./random.js";
import type {
  Brand,
  Customer,
  Item,
  OpeningBalances,
  Person,
  Vendor,
  VendorBankAccount,
} from "./types.js";

const pad = (n: number, width = 4): string => String(n).padStart(width, "0");

const ITEMS_PER_BRAND = 25;

/**
 * Every sixth item is kept low on purpose: an order for a lot of one of them
 * is short, so the stock purchase requests have something to follow from.
 * Ordinary order lines never use them.
 */
export function isLowStockIndex(itemIndex: number): boolean {
  return itemIndex % 6 === 3;
}

export function makePeople(): Person[] {
  return TEAM.map((member) => ({
    name: member.name,
    role: member.role,
    brands: member.category
      ? BRANDS.filter((b) => b.category === member.category).map((b) => b.name)
      : [],
  }));
}

export function makeBrands(): Brand[] {
  return BRANDS.map((brand) => {
    const owner = TEAM.find(
      (member) =>
        member.role === "PRODUCT_MANAGER" && member.category === brand.category,
    );
    if (!owner) throw new Error(`No product manager for ${brand.category}`);
    return { ...brand, owner: owner.name };
  });
}

export function makeCustomers(random: SeededRandom): Customer[] {
  return CUSTOMER_NAMES.map(([name, country], i) => {
    const limit = random.int(50, 300) * 1_000;
    return {
      no: `C-${pad(i + 1)}`,
      name,
      countryRegionCode: country,
      currencyCode: "USD",
      paymentTermsCode: PAYMENT_TERMS[i % PAYMENT_TERMS.length] ?? "30 DAYS",
      customerPriceGroup: PRICE_GROUPS[i % PRICE_GROUPS.length] ?? "DIST-A",
      creditLimitLcy: `${String(limit)}.00`,
      balanceLcy: random.money(0, Math.floor(limit / 2)),
    };
  });
}

export function makeVendors(random: SeededRandom): Vendor[] {
  return VENDOR_NAMES.map((name, i) => ({
    no: `V-${pad(i + 1)}`,
    name,
    currencyCode: "USD",
    paymentTermsCode: ["30 DAYS", "60 DAYS", "PREPAID"][i % 3] ?? "30 DAYS",
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
    const products = PRODUCTS[brand.category];
    for (let j = 0; j < ITEMS_PER_BRAND; j++) {
      const index = items.length;
      const product = products[j % products.length];
      const variant = VARIANTS[Math.floor(j / products.length)];
      const vendor = vendors[(b + (j % 2)) % vendors.length];
      if (!product || !variant || !vendor)
        throw new Error("Items need a product");
      const base = random.int(product.price[0] * 100, product.price[1] * 100);
      const price = ((base * variant.price) / 100).toFixed(2);
      const low = isLowStockIndex(index);
      const inventory = low ? random.int(10, 60) : random.int(150, 900);
      const prefix = brand.name.slice(0, 3).toUpperCase();
      items.push({
        no: `I-${pad(index + 1)}`,
        description: `${brand.name} ${product.name}${variant.label}`,
        brand: brand.name,
        category: brand.category,
        partNumber: `${prefix}-${product.code}-${variant.code}-${String(2400 + index)}`,
        baseUnitOfMeasure: "PCS",
        unitPrice: price,
        unitCost: (Number(price) * product.cost).toFixed(2),
        inventory: String(inventory),
        qtyOnSalesOrder: String(random.int(0, low ? (inventory / 2) | 0 : 60)),
        qtyOnPurchOrder: String(random.int(0, low ? 20 : 400)),
        vendorNo: vendor.no,
        vendorItemNo: `${prefix}-${pad(index + 100)}`,
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
