import { ROLES } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { OrderMasking } from "./order-masking.js";

const masking = new OrderMasking();

describe("order masking", () => {
  it("hides amounts from Warehouse and Logistics with the reason price", () => {
    for (const role of ["WAREHOUSE", "LOGISTICS"] as const) {
      expect(masking.amount(role, "12.00")).toMatchObject({
        masked: true,
        value: null,
        reason: "price",
      });
      expect(masking.canSeeAmount(role)).toBe(false);
    }
  });

  it("shows amounts to the roles that quote", () => {
    expect(masking.amount("SUPPORT", "12.00")).toMatchObject({
      masked: false,
      value: "12.00",
      reason: null,
    });
    expect(masking.canSeeAmount("SUPPORT")).toBe(true);
  });

  it("agrees with itself for every role", () => {
    for (const role of ROLES)
      expect(masking.canSeeAmount(role)).toBe(
        !masking.amount(role, "1").masked,
      );
  });
});
