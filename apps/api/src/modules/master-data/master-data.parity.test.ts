import { createSyntheticDataset } from "@orderpilot/synthetic-data";
import { describe, expect, it } from "vitest";
import type { OrderDirectory } from "../orders/domain/order-directory.js";
import type { OrderFacts } from "../orders/domain/order-facts.js";
import { facts } from "../orders/domain/test-facts.js";
import { SampleOrderSource } from "../orders/directory/sample-order-source.js";
import {
  listedInMasterData,
  toMasterDataSalesOrder,
} from "./domain/order-mapping.js";
import { MasterDataService } from "./master-data.service.js";
import { MockBusinessCentralMasterData } from "./mock-business-central-master-data.js";

const dataset = createSyntheticDataset();
const reader = new MockBusinessCentralMasterData(() => dataset);
const samples = new SampleOrderSource(() => dataset);

const customer = dataset.customers[0];
const item = dataset.items[0];
if (!customer || !item) throw new Error("the set is empty");

describe("master data asks the directory", () => {
  it("maps all 120 samples to exactly what the mock of Business Central reports", async () => {
    const asked = (await samples.list()).map(toMasterDataSalesOrder);
    const reported = await reader.salesOrders();
    expect(asked).toHaveLength(120);
    expect(asked).toEqual(reported);
  });

  it("lists samples always, and stored orders only once submitted", () => {
    const stored = (captureState: "draft" | "submitted" | "void") =>
      facts({ captureState });
    expect(listedInMasterData(stored("submitted"))).toBe(true);
    expect(listedInMasterData(stored("draft"))).toBe(false);
    expect(listedInMasterData(stored("void"))).toBe(false);
    expect(
      listedInMasterData(facts({ source: "sample", captureState: null })),
    ).toBe(true);
  });

  describe("with a stored order beside the samples", () => {
    const stored = (
      orderNo: string,
      captureState: OrderFacts["captureState"],
    ) =>
      facts({
        orderNo,
        captureState,
        customerNo: customer.no,
        externalDocumentNo: `PO-${orderNo.slice(-4)}`,
        lines: [
          {
            lineNo: 1,
            itemNo: item.no,
            description: item.description,
            quantity: "3.000",
            unitPrice: "12.50",
            qtyToShip: "3.000",
          },
        ],
      });
    const directory = (extra: OrderFacts[]): OrderDirectory => ({
      list: async () => [...(await samples.list()), ...extra],
      find: (no) =>
        Promise.resolve(extra.find((order) => order.orderNo === no) ?? null),
    });
    const withStored = new MasterDataService(
      reader,
      directory([
        stored("SO-20261108-0001", "submitted"),
        stored("SO-20261108-0002", "draft"),
        stored("SO-20261108-0003", "void"),
      ]),
    );
    const without = new MasterDataService(reader, directory([]));

    it("shows a submitted order among a customer's open orders, and no draft or void one", async () => {
      const shown = await withStored.customer(customer.no, "SUPPORT");
      const numbers = shown.openOrders.map((order) => order.orderNo);
      expect(numbers).toContain("SO-20261108-0001");
      expect(numbers).not.toContain("SO-20261108-0002");
      expect(numbers).not.toContain("SO-20261108-0003");
      const before = await without.customer(customer.no, "SUPPORT");
      expect(shown.openOrders).toHaveLength(before.openOrders.length + 1);
    });

    it("shows a submitted order on the item's lines, and leaves Business Central's figures alone", async () => {
      const shown = await withStored.item(item.no, "SUPPORT");
      const before = await without.item(item.no, "SUPPORT");
      expect(shown.orderLines.map((line) => line.orderNo)).toContain(
        "SO-20261108-0001",
      );
      expect(shown.orderLines).toHaveLength(before.orderLines.length + 1);
      expect(shown.qtyOnSalesOrder).toBe(before.qtyOnSalesOrder);
      expect(shown.availableStock).toBe(before.availableStock);
      expect(
        shown.orderLines.find((l) => l.orderNo === "SO-20261108-0001"),
      ).toMatchObject({ shortfall: null });
    });
  });
});
