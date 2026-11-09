import { addDecimal, multiplyDecimal } from "@orderpilot/shared";
import {
  BRANDS,
  BRAND_OWNERS,
  PART_NUMBER_STYLES,
  isLowStockIndex,
  planCatalogue,
} from "./catalogue-plan.js";
import {
  CUSTOMER_NAMES,
  PAYMENT_TERMS,
  FIRST_CUSTOMER_COUNT,
  TEAM,
  VENDOR_NAMES,
} from "./names.js";
import { addressOf, taxIdOf } from "./places.js";
import { SeededRandom, hashUnit } from "./random.js";
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

export { isLowStockIndex };

export function makePeople(): Person[] {
  return TEAM.map((member) => ({
    name: member.name,
    role: member.role,
    brands:
      member.role === "PRODUCT_MANAGER"
        ? BRANDS.filter((b) => BRAND_OWNERS[b.name] === member.name).map(
            (b) => b.name,
          )
        : [],
    ...(member.sprCoordinator ? { sprCoordinator: true as const } : {}),
  }));
}

/**
 * The Support people who take turns owning orders. The coordinator is left out
 * on purpose: the order rotation keeps its two people, so no order changes hands.
 */
export function supportsInRotation(people: readonly Person[]): string[] {
  return people
    .filter((p) => p.role === "SUPPORT" && !p.sprCoordinator)
    .map((p) => p.name);
}

export function makeBrands(): Brand[] {
  return BRANDS.map((brand) => {
    const owner = BRAND_OWNERS[brand.name];
    if (!owner) throw new Error(`No product manager for ${brand.name}`);
    return { ...brand, owner };
  });
}

/**
 * C-0001 to C-0040 draw from the main stream exactly as before the briefing
 * data, so every live order keeps its state and age. The customers after them
 * draw from a stream of their own, and the addresses and tax numbers are pure
 * functions of the customer number.
 */
export function makeCustomers(random: SeededRandom, seed: number): Customer[] {
  const later = SeededRandom.child(seed, "customers-2");
  return CUSTOMER_NAMES.map(([name, country], i) => {
    const stream = i < FIRST_CUSTOMER_COUNT ? random : later;
    const limit = stream.int(50, 300) * 1_000;
    return {
      no: `C-${pad(i + 1)}`,
      name,
      countryRegionCode: country,
      currencyCode: "USD",
      paymentTermsCode: PAYMENT_TERMS[i % PAYMENT_TERMS.length] ?? "30 DAYS",
      ...addressOf(i + 1, country),
      taxRegistrationNumber: taxIdOf(i + 1, country),
      creditLimitLcy: `${String(limit)}.00`,
      balanceLcy: stream.money(0, Math.floor(limit / 2)),
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

/**
 * The items, by the catalogue plan. Each item still takes the same four draws
 * in the same order as before the briefing data, so every number drawn after
 * them, and with it every live order's state and age, stays where it was.
 */
export function makeItems(
  random: SeededRandom,
  vendors: readonly Vendor[],
  seed: number,
): Item[] {
  const items: Item[] = [];
  const brandIndex = new Map(BRANDS.map((brand, b) => [brand.name, b]));
  const insideBrand = new Map<string, number>();
  for (const plan of planCatalogue()) {
    const { brand, productClass } = plan;
    const index = items.length;
    const j = insideBrand.get(brand.name) ?? 0;
    insideBrand.set(brand.name, j + 1);
    const vendor =
      vendors[((brandIndex.get(brand.name) ?? 0) + (j % 2)) % vendors.length];
    const style = PART_NUMBER_STYLES[brand.name];
    if (!vendor || !style) throw new Error("Items need a vendor and a style");
    const price = (
      random.int(productClass.price[0] * 100, productClass.price[1] * 100) / 100
    ).toFixed(2);
    const low = isLowStockIndex(index);
    const inventory = low ? random.int(10, 60) : random.int(150, 900);
    // Qty. on Sales Order starts at nothing: the sample's open orders are
    // all there is, so their lines add up to it. The draw that once gave it
    // a base figure stays, so every number drawn after it stays put.
    random.int(0, low ? (inventory / 2) | 0 : 60);
    const [fastest, slowest] = productClass.leadTimeDays;
    const no = `I-${pad(index + 1)}`;
    items.push({
      no,
      description: `${brand.name} ${plan.label}`,
      brand: brand.name,
      category: productClass.category,
      partNumber: style(pad(index + 1)),
      baseUnitOfMeasure: "PCS",
      unitPrice: price,
      unitCost: (Number(price) * productClass.cost).toFixed(2),
      inventory: String(inventory),
      qtyOnSalesOrder: "0",
      qtyOnPurchOrder: String(random.int(0, low ? 20 : 400)),
      vendorNo: vendor.no,
      vendorItemNo: `${brand.name.slice(0, 3).toUpperCase()}-${pad(index + 100)}`,
      leadTimeDays:
        fastest +
        Math.floor(hashUnit(seed, "lead", no) * (slowest - fastest + 1)),
    });
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
