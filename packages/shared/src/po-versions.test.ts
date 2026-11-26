import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  PO_VERSION_NO_MAX,
  SHIPMENT_BEFORE_ORDER_MESSAGE,
  confirmPoVersionSchema,
  poVersionDiffQuerySchema,
  poVersionParamSchema,
  priceDifferenceSchema,
} from "./index.js";

const body = {
  customerNo: "C-0001",
  externalDocumentNo: "PO-1",
  orderDate: "2026-11-08",
  shipmentDate: null,
  prepaymentPercent: "30",
  lines: [{ itemNo: "I-0001", quantity: "2", unitPrice: "12.50" }],
};

describe("confirmPoVersionSchema", () => {
  it("refuses a body without confirmed, with confirmed false, without expectedPoVersionNo, with a fractional or zero one", () => {
    const sent = { ...body, confirmed: true, expectedPoVersionNo: 1 };
    expect(confirmPoVersionSchema.safeParse(sent).success).toBe(true);
    const withoutConfirmed = { ...sent, confirmed: undefined };
    expect(confirmPoVersionSchema.safeParse(withoutConfirmed).success).toBe(
      false,
    );
    expect(
      confirmPoVersionSchema.safeParse({ ...sent, confirmed: false }).success,
    ).toBe(false);
    const withoutExpected = { ...sent, expectedPoVersionNo: undefined };
    expect(confirmPoVersionSchema.safeParse(withoutExpected).success).toBe(
      false,
    );
    for (const bad of [1.5, 0, -1, PO_VERSION_NO_MAX + 1])
      expect(
        confirmPoVersionSchema.safeParse({ ...sent, expectedPoVersionNo: bad })
          .success,
      ).toBe(false);
  });

  it("accepts the create fields plus confirmed true and an expected number", () => {
    const parsed = confirmPoVersionSchema.parse({
      ...body,
      confirmed: true,
      expectedPoVersionNo: 3,
    });
    expect(parsed.expectedPoVersionNo).toBe(3);
    expect(parsed.confirmed).toBe(true);
  });

  it("refuses a shipment date before the order date", () => {
    const result = confirmPoVersionSchema.safeParse({
      ...body,
      shipmentDate: "2026-11-01",
      confirmed: true,
      expectedPoVersionNo: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["shipmentDate"]);
      expect(result.error.issues[0]?.message).toBe(
        SHIPMENT_BEFORE_ORDER_MESSAGE,
      );
    }
  });
});

describe("poVersionParamSchema", () => {
  it("refuses abc, 0, 1.5 and a number above the column", () => {
    for (const bad of ["abc", "0", "1.5", String(PO_VERSION_NO_MAX + 1)])
      expect(poVersionParamSchema.safeParse(bad).success).toBe(false);
    expect(poVersionParamSchema.parse("2")).toBe(2);
    expect(poVersionParamSchema.parse(String(PO_VERSION_NO_MAX))).toBe(
      PO_VERSION_NO_MAX,
    );
  });
});

describe("priceDifferenceSchema", () => {
  it("accepts a masked object with no from, to or changed, and refuses one that carries a price", () => {
    const masked = {
      masked: true,
      field: "item.unitPrice",
      classification: "confidential",
      reason: "price",
    };
    expect(priceDifferenceSchema.safeParse(masked).success).toBe(true);
    expect(
      priceDifferenceSchema.safeParse({ ...masked, from: "12.50" }).success,
    ).toBe(false);
    expect(
      priceDifferenceSchema.safeParse({ ...masked, changed: true }).success,
    ).toBe(false);
    expect(
      priceDifferenceSchema.safeParse({ masked: true, from: "1.00" }).success,
    ).toBe(false);
    expect(
      priceDifferenceSchema.safeParse({
        masked: false,
        from: "12.50",
        to: "13.00",
        changed: true,
      }).success,
    ).toBe(true);
  });
});

describe("the OpenAPI writer", () => {
  it("keeps integer, minimum and maximum on the diff query", () => {
    const json = z.toJSONSchema(poVersionDiffQuerySchema, {
      target: "openapi-3.0",
      io: "input",
    });
    for (const name of ["from", "to"]) {
      const property = json.properties?.[name] as {
        type?: string;
        minimum?: number;
        maximum?: number;
      };
      expect(property.type).toBe("integer");
      expect(property.minimum).toBe(1);
      expect(property.maximum).toBe(PO_VERSION_NO_MAX);
    }
  });
});
