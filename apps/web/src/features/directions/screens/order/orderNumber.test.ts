import { describe, expect, it } from "vitest";
import { canonicalOrderNo, isOrderNo } from "./orderNumber";

describe("canonicalOrderNo", () => {
  it("puts a typed number in capitals and trims it", () => {
    expect(canonicalOrderNo("so-0082")).toBe("SO-0082");
    expect(canonicalOrderNo(" So-20261108-0001 ")).toBe("SO-20261108-0001");
  });

  it("leaves a number that is already right alone", () => {
    expect(canonicalOrderNo("SO-0082")).toBe("SO-0082");
  });
});

describe("isOrderNo", () => {
  it("accepts the numbers the API knows", () => {
    expect(isOrderNo("SO-0082")).toBe(true);
    expect(isOrderNo("SO-20261108-0001")).toBe(true);
    expect(isOrderNo("NOPE-1")).toBe(true);
  });

  it.each(["", "SO 0082", "SO-0082!", "<b>", "SO/0082", "A".repeat(31)])(
    "refuses %j, which cannot be an order number",
    (value) => {
      expect(isOrderNo(value)).toBe(false);
    },
  );
});
