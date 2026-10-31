import { describe, expect, it } from "vitest";
import { formatDay, formatMoney } from "./format";

describe("formatMoney", () => {
  it("groups thousands and keeps two decimals", () => {
    expect(formatMoney("12340")).toBe("USD 12,340.00");
    expect(formatMoney("0.5")).toBe("USD 0.50");
    expect(formatMoney("1250.50", "SGD")).toBe("SGD 1,250.50");
  });

  it("never goes through a float: long amounts keep every digit", () => {
    expect(formatMoney("123456789012345.1234")).toBe(
      "USD 123,456,789,012,345.1234",
    );
    expect(formatMoney("0.1")).toBe("USD 0.10");
    expect(formatMoney("900719925474099.10")).toBe(
      "USD 900,719,925,474,099.10",
    );
  });

  it("drops trailing zeros beyond two decimals", () => {
    expect(formatMoney("1.2300")).toBe("USD 1.23");
    expect(formatMoney("1.2340")).toBe("USD 1.234");
  });

  it("shows the sign, and no sign on zero", () => {
    expect(formatMoney("-1250.5")).toBe("USD -1,250.50");
    expect(formatMoney("-0.00")).toBe("USD 0.00");
  });

  it("shows a value that is not a decimal string as it came", () => {
    expect(formatMoney("n/a")).toBe("USD n/a");
  });
});

describe("formatDay", () => {
  it("is short, in Singapore time", () => {
    expect(formatDay("2026-11-02T00:00:00Z")).toBe("2 Nov 2026");
    // 17:00 UTC is already the next day in Singapore.
    expect(formatDay("2026-11-02T17:00:00Z")).toBe("3 Nov 2026");
  });
});
