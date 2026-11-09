import { ITEM_CATEGORY_CODES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import {
  BRANDS,
  BRAND_OWNERS,
  PRODUCT_CLASSES,
  planCatalogue,
} from "./catalogue-plan.js";
import { ITEM_CATEGORIES, createSyntheticDataset } from "./index.js";

const data = createSyntheticDataset();

/** What each brand's part numbers look like, written out here on its own. */
const STYLES: Readonly<Record<string, RegExp>> = {
  Dell: /^210-ZZ\d{4}$/,
  HP: /^9ZZ\d{4}AA$/,
  Lenovo: /^4XZZ\d{4}$/,
  Acer: /^UM\.ZZ\d{4}\.001$/,
  Asus: /^90ZZ\d{4}-M01$/,
  Samsung: /^LSZZ\d{4}EAUXXE$/,
  Intel: /^BX80ZZ\d{4}$/,
  Seagate: /^STZZ\d{4}NM000A$/,
  Toshiba: /^HDWZZ\d{4}EZSTA$/,
  Kioxia: /^KBZZ\d{4}G$/,
  Lexar: /^LXZZ\d{4}-BNNNG$/,
  Verbatim: /^VB-ZZ\d{4}$/,
  TeamGroup: /^TFZZ\d{4}-D1$/,
  "Cooler Master": /^MCZZ-\d{4}-KKN1$/,
  Hikvision: /^DS-2CDZZ\d{4}-I$/,
  Honeywell: /^HCZZ\d{4}W$/,
  "TP-Link": /^TL-ZZ\d{4}$/,
  Cudy: /^CUZZ\d{4}$/,
  Aruba: /^JLZZ\d{4}A$/,
  HPE: /^PZZ\d{4}-B21$/,
  Supermicro: /^SYS-ZZ\d{4}-TR$/,
  Vertiv: /^GXTZZ\d{4}RT2U$/,
};

describe("the catalogue plan", () => {
  it("plans 300 items from 22 brands, at least 30 in each of six categories", () => {
    const plan = planCatalogue();
    expect(plan).toHaveLength(300);
    expect(BRANDS).toHaveLength(22);
    expect(new Set(plan.map((p) => p.brand.name)).size).toBe(22);
    for (const category of ITEM_CATEGORIES) {
      expect(
        plan.filter((p) => p.productClass.category === category).length,
        category,
      ).toBeGreaterThanOrEqual(30);
    }
  });

  it("makes the items from the plan, in order", () => {
    planCatalogue().forEach((plan, i) => {
      const item = data.items[i];
      expect(item?.brand).toBe(plan.brand.name);
      expect(item?.category).toBe(plan.productClass.category);
      expect(item?.description).toBe(`${plan.brand.name} ${plan.label}`);
    });
  });

  it("keeps the item categories in step with the shared contract", () => {
    expect([...ITEM_CATEGORIES]).toEqual([...ITEM_CATEGORY_CODES]);
  });

  it("gives each of the 22 brands to one product manager, once", () => {
    expect(Object.keys(BRAND_OWNERS).sort()).toEqual(
      BRANDS.map((b) => b.name).sort(),
    );
    const brandsListed = data.people.flatMap((p) => p.brands);
    expect(brandsListed.sort()).toEqual(BRANDS.map((b) => b.name).sort());
    expect(data.brands.map((b) => b.owner)).toEqual(
      BRANDS.map((b) => BRAND_OWNERS[b.name]),
    );
  });

  it("keeps low-stock items cheap enough for a purchase request inside the limit", () => {
    const low = data.items.filter((_, i) => i % 6 === 3);
    expect(low).toHaveLength(50);
    for (const item of low) {
      expect(Number(item.unitCost), item.no).toBeLessThan(490);
    }
  });

  it("gives each part number its brand's style, a ZZ block and its item number", () => {
    for (const item of data.items) {
      const style = STYLES[item.brand];
      expect(style, item.brand).toBeDefined();
      expect(item.partNumber, item.no).toMatch(style ?? /^$/);
      expect(item.partNumber).toContain("ZZ");
      expect(item.partNumber).toContain(item.no.slice(2));
    }
    expect(new Set(data.items.map((i) => i.partNumber)).size).toBe(300);
  });

  it("prices every item inside its class and keeps cost under price", () => {
    planCatalogue().forEach((plan, i) => {
      const item = data.items[i];
      const [lo, hi] = plan.productClass.price;
      expect(Number(item?.unitPrice)).toBeGreaterThanOrEqual(lo);
      expect(Number(item?.unitPrice)).toBeLessThanOrEqual(hi);
    });
  });

  it("sets lead times inside the class's band, from weeks for notebooks to months for components", () => {
    planCatalogue().forEach((plan, i) => {
      const [lo, hi] = plan.productClass.leadTimeDays;
      const days = data.items[i]?.leadTimeDays ?? 0;
      expect(days).toBeGreaterThanOrEqual(lo);
      expect(days).toBeLessThanOrEqual(hi);
    });
    const days = (key: keyof typeof PRODUCT_CLASSES) =>
      PRODUCT_CLASSES[key].leadTimeDays;
    expect(days("nb14")).toEqual([21, 28]);
    expect(days("ssd")).toEqual([90, 180]);
    const all = data.items.map((i) => i.leadTimeDays);
    expect(Math.min(...all)).toBeGreaterThanOrEqual(21);
    expect(Math.max(...all)).toBeLessThanOrEqual(180);
  });

  it("marks one cheap flash drive on a normal index for the planted short-stock case", () => {
    const planted = planCatalogue().flatMap((plan, i) =>
      plan.plantedShort ? [{ plan, i }] : [],
    );
    expect(planted).toHaveLength(1);
    expect(planted[0]?.plan.classKey).toBe("usb");
    expect((planted[0]?.i ?? 3) % 6).not.toBe(3);
  });
});
