import { describe, expect, it } from "vitest";
import {
  availableStock,
  createSyntheticDataset,
  plantedCases,
  respelling,
} from "./index.js";
import { lookAlikeName } from "./orders.js";

const data = createSyntheticDataset();
const planted = plantedCases(data);

describe("the planted cases", () => {
  it("finds each case by record, and throws when one is lost", () => {
    expect(planted.lookAlikes.length).toBeGreaterThanOrEqual(2);
    const lost = createSyntheticDataset();
    lost.orders = lost.orders.filter(
      (order) => order.scenario.kind !== "pi-price-mismatch",
    );
    expect(() => plantedCases(lost)).toThrow(/PI price mismatch/);
  });

  it("plants a PO for 1,000 of an item with 640 in stock", () => {
    const { order, item } = planted.shortStock;
    expect(item.brand).toBe("Lexar");
    expect(item.description).toContain("USB Flash Drive");
    expect(item.inventory).toBe("640");
    expect(item.qtyOnPurchOrder).toBe("0");
    expect(availableStock(item)).toBe("640.00");
    if (order.scenario.kind !== "short-stock") throw new Error("kind");
    expect(order.scenario.itemNo).toBe(item.no);
    expect(order.scenario.ordered).toBe("1000");
    expect(order.scenario.inStock).toBe("640");
    expect(order.scenario.shortBy).toBe("360.00");
    expect(order.lines[0]?.no).toBe(item.no);
    expect(order.lines[0]?.quantity).toBe("1000");
    expect(order.sampleScreenState).toBe("sample-short-stock");
    // It is the first order short on stock, by SO number.
    const first = data.orders.find(
      (o) => o.sampleScreenState === "sample-short-stock",
    );
    expect(first?.header.no).toBe(order.header.no);
  });

  it("keeps the SPR basis equal to the item and under the approver's limit", () => {
    const { item, spr } = planted.shortStock;
    expect(spr.itemNo).toBe(item.no);
    expect(spr.quantity).toBe("360.00");
    expect(spr.basis.inventory).toBe(item.inventory);
    expect(spr.basis.qtyOnPurchOrder).toBe(item.qtyOnPurchOrder);
    expect(spr.basis.qtyOnSalesOrder).toBe(item.qtyOnSalesOrder);
    expect(spr.basis.availableStock).toBe(availableStock(item));
    expect(spr.basis.shortfall).toBe("360.00");
    expect(Number(spr.amount)).toBeLessThanOrEqual(4_900);
    for (const other of data.sprs) {
      expect(Number(other.amount)).toBeLessThanOrEqual(4_900);
    }
  });

  it("keeps the planted item out of every other line", () => {
    const { item, order } = planted.shortStock;
    for (const other of data.orders) {
      if (other === order) continue;
      expect(other.lines.some((line) => line.no === item.no)).toBe(false);
    }
  });

  it("plants a draft PI that prints a higher price than the PO, on line 1 only", () => {
    const { order } = planted.piPriceMismatch;
    if (order.scenario.kind !== "pi-price-mismatch") throw new Error("kind");
    const first = order.lines[0];
    expect(order.sampleScreenState).toBe("sample-pi-to-send");
    expect(order.scenario.itemNo).toBe(first?.no);
    expect(order.scenario.poPrice).toBe(first?.unitPrice);
    const rise =
      Number(order.scenario.piPrice) - Number(order.scenario.poPrice);
    expect(rise).toBeCloseTo(
      Number(order.scenario.poPrice) < 20 ? 0.5 : 1.5,
      2,
    );
    const pi = order.documents.find((d) => d.type === "PROFORMA_INVOICE");
    expect(pi?.status).toBe("to-confirm");
    const firstOfState = data.orders.find(
      (o) => o.sampleScreenState === "sample-pi-to-send",
    );
    expect(firstOfState?.header.no).toBe(order.header.no);
    expect(
      data.orders.filter((o) => o.scenario.kind === "pi-price-mismatch"),
    ).toHaveLength(1);
  });

  it("raises the PI price mismatch as an exception, in words about the PI", () => {
    const { order } = planted.piPriceMismatch;
    if (order.scenario.kind !== "pi-price-mismatch") throw new Error("kind");
    const raised = data.exceptions.filter((e) => e.orderNo === order.header.no);
    expect(raised).toHaveLength(1);
    expect(raised[0]?.ruleLabel).toBe(
      "Unit price on the PI against the PO (sample result)",
    );
    expect(raised[0]?.summary).toContain(
      `the PI prints ${order.scenario.piPrice}, the PO says ${order.scenario.poPrice}`,
    );
    expect(raised[0]?.expected).toBe(order.scenario.poPrice);
    expect(raised[0]?.found).toBe(order.scenario.piPrice);
  });

  it("has no price list left in the set", () => {
    const text = JSON.stringify(data).toLowerCase();
    expect(text).not.toContain("price list");
    expect(text).not.toContain(`"kind":"price-mismatch"`);
    expect(text).not.toContain("differing unit price");
    expect(
      data.orders
        .filter(
          (o) => o.sampleScreenState === "sample-extracted-awaiting-review",
        )
        .every((o) => o.scenario.kind === "none"),
    ).toBe(true);
  });

  it("plants a draft air waybill that names a consignee one letter off the buyer", () => {
    const { order, document } = planted.wrongConsignee;
    expect(order.sampleScreenState).toBe("sample-ready-to-pick");
    expect(Number(order.header.no.slice(3)) % 2).toBe(1);
    expect(document.type).toBe("AWB");
    expect(document.status).toBe("to-confirm");
    expect(document.consignee).not.toBe(order.shipTo.name);
    expect(document.notifyParty).toBe(order.shipTo.name);
    const a = document.consignee ?? "";
    const b = order.shipTo.name;
    expect(a).toHaveLength(b.length);
    expect(a.split("").filter((c, i) => c !== b[i])).toHaveLength(1);
    const first = data.orders.find(
      (o) =>
        o.sampleScreenState === "sample-ready-to-pick" &&
        Number(o.header.no.slice(3)) % 2 === 1,
    );
    expect(first?.header.no).toBe(order.header.no);
    expect(
      data.orders
        .flatMap((o) => o.documents)
        .filter((d) => d.consignee !== undefined),
    ).toHaveLength(1);
  });

  it("gives the draft waybill an id of its own and leaves the other ids unique", () => {
    const ids = data.orders.flatMap((o) => o.documents.map((d) => d.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(planted.wrongConsignee.document.id.startsWith("5a7d0008")).toBe(
      true,
    );
    expect(ids.filter((id) => id.startsWith("5a7d0008"))).toHaveLength(1);
  });

  it("changes one letter of a name, whatever it looks like", () => {
    expect(lookAlikeName("Sagarun Trading")).toBe("Segarun Trading");
    expect(lookAlikeName("Xyz")).not.toBe("Xyz");
    expect(lookAlikeName("Xyz")).toHaveLength(3);
  });

  it("plants look-alike customers with their own numbers and tax IDs", () => {
    expect(planted.lookAlikes).toHaveLength(2);
    for (const [a, b] of planted.lookAlikes) {
      expect(a.no).not.toBe(b.no);
      expect(a.name).not.toBe(b.name);
      expect(a.taxRegistrationNumber).not.toBe(b.taxRegistrationNumber);
      expect(a.countryRegionCode).toBe(b.countryRegionCode);
    }
  });

  it("plants a respelled name for a customer, not a second customer", () => {
    const { customer, printedAs } = planted.respelled;
    expect(printedAs).not.toBe(customer.name);
    const squash = (name: string) =>
      name.toLowerCase().replace(/[^a-z0-9]/g, "");
    expect(squash(printedAs)).toBe(squash(customer.name));
    expect(
      data.customers.filter((c) => squash(c.name) === squash(printedAs)),
    ).toHaveLength(1);
    expect(respelling("Asha Trading Pvt Ltd")).toBe("ASHA TRADING PVT. LTD.");
  });

  it("plants a company that master data does not hold", () => {
    const { newCustomer } = planted;
    expect(data.customers.map((c) => c.name)).not.toContain(newCustomer.name);
    expect(data.customers.map((c) => c.taxRegistrationNumber)).not.toContain(
      newCustomer.taxRegistrationNumber,
    );
    expect(newCustomer.taxRegistrationNumber).toContain("ZZ");
  });
});
