import {
  customerResponseSchema,
  itemResponseSchema,
  salesOrderListSchema,
  salesOrderResponseSchema,
} from "@orderpilot/shared";
import { setDemoStoryline } from "@orderpilot/synthetic-data";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyDemoScenario } from "../../src/common/demo-scenario.js";
import { API, call, demoSignIn, type Browser } from "../support/auth.js";
import { resetTestData } from "../support/reset.js";
import { createTestApp, type TestApp } from "../support/test-app.js";

describe("the demo storyline (DEMO_STORYLINE=true)", () => {
  let t: TestApp;
  let support: Browser;

  beforeAll(async () => {
    await resetTestData();
    t = await createTestApp({ DEMO_STORYLINE: "true" });
    // As main.ts does, before anything reads the sample data.
    applyDemoScenario(t.config);
    support = await demoSignIn(t, "SUPPORT");
  });
  afterAll(async () => {
    // The switch is module state: leave it as the other tests expect it.
    setDemoStoryline(false);
    await t.close();
  });
  const get = (path: string) => call(t, support, "get", path);

  it("reads the setting as true", () => {
    expect(t.config.demoStoryline).toBe(true);
  });

  it("shows SO-0082 as PO 4471-26 from C-1042, one SSD line, short of stock", async () => {
    const found = salesOrderListSchema.parse(
      (await get(`${API}/orders?search=4471-26`)).body,
    );
    expect(found.data.map((row) => row.orderNo)).toEqual(["SO-0082"]);
    const order = salesOrderResponseSchema.parse(
      (await get(`${API}/orders/SO-0082`)).body,
    ).data;
    expect(order).toMatchObject({
      customerNo: "C-1042",
      customerName: "Meridian Vale Technologies Pvt Ltd",
      externalDocumentNo: "4471-26",
    });
    expect(order.lines).toHaveLength(1);
    expect(order.lines[0]).toMatchObject({
      itemNo: "I-0075",
      quantity: "1000",
    });
    expect(order.lines[0]?.unitPrice).toMatchObject({ value: "61.20" });
    expect(order.amount).toMatchObject({ value: "61200.00" });
    const stock = itemResponseSchema.parse(
      (await get(`${API}/master-data/items/I-0075`)).body,
    ).data.availableStock;
    expect(Number(stock)).toBeLessThan(1000);
    expect(order.shortage).toMatchObject({
      itemNo: "I-0075",
      ordered: "1000.00",
    });
    expect(order.lines[0]?.shortBy).toBe((1000 - Number(stock)).toFixed(2));
  });

  it("finds C-1042 in master data", async () => {
    const customer = customerResponseSchema.parse(
      (await get(`${API}/master-data/customers/C-1042`)).body,
    ).data;
    expect(customer).toMatchObject({
      no: "C-1042",
      name: "Meridian Vale Technologies Pvt Ltd",
    });
  });
});
