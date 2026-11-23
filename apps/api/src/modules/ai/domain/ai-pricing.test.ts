import { DECIMAL_PATTERN } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { AiPricing } from "./ai-pricing.js";

const real = { mock: false };

describe("the cost estimate", () => {
  it("is tokens times the price per million, to four places", () => {
    const pricing = new AiPricing({
      inputUsdPerMtok: "0.15",
      outputUsdPerMtok: "0.6",
    });
    expect(
      pricing.estimate({ inputTokens: 1_000_000, outputTokens: 0 }, real),
    ).toBe("0.1500");
    expect(
      pricing.estimate({ inputTokens: 0, outputTokens: 1_000_000 }, real),
    ).toBe("0.6000");
    expect(
      pricing.estimate({ inputTokens: 12_000, outputTokens: 800 }, real),
    ).toBe("0.0023");
  });

  it("is 0.0000 when no price is set, which is the default", () => {
    const pricing = new AiPricing({
      inputUsdPerMtok: "0",
      outputUsdPerMtok: "0",
    });
    expect(
      pricing.estimate({ inputTokens: 5_000_000, outputTokens: 9_000 }, real),
    ).toBe("0.0000");
  });

  it("is always 0.0000 for the mock, whatever the prices", () => {
    const pricing = new AiPricing({
      inputUsdPerMtok: "5",
      outputUsdPerMtok: "15",
    });
    expect(
      pricing.estimate(
        { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        { mock: true },
      ),
    ).toBe("0.0000");
  });

  it("rounds half up, once, on the sum", () => {
    const pricing = new AiPricing({
      inputUsdPerMtok: "1",
      outputUsdPerMtok: "1",
    });
    // 250 tokens at $1 per million is 2.5 of the smallest unit: up to 3.
    expect(pricing.estimate({ inputTokens: 250, outputTokens: 0 }, real)).toBe(
      "0.0003",
    );
    expect(pricing.estimate({ inputTokens: 249, outputTokens: 0 }, real)).toBe(
      "0.0002",
    );
    // Two halves make one whole: rounding each part first would give 0.0006.
    expect(
      pricing.estimate({ inputTokens: 125, outputTokens: 125 }, real),
    ).toBe("0.0003");
    expect(pricing.estimate({ inputTokens: 100, outputTokens: 0 }, real)).toBe(
      "0.0001",
    );
  });

  it("keeps six decimals of price", () => {
    const pricing = new AiPricing({
      inputUsdPerMtok: "0.075",
      outputUsdPerMtok: "0.000001",
    });
    expect(
      pricing.estimate({ inputTokens: 1_000_000, outputTokens: 0 }, real),
    ).toBe("0.0750");
    expect(
      pricing.estimate({ inputTokens: 0, outputTokens: 1_000_000 }, real),
    ).toBe("0.0000");
  });

  it("is exact on large figures, which a float would blur", () => {
    const pricing = new AiPricing({
      inputUsdPerMtok: "123.456789",
      outputUsdPerMtok: "0",
    });
    const tokens = 9_007_199_254_740_991;
    // Worked out separately in bigint: price in micro-dollars, rounded half up to 1e-4.
    const expected = (BigInt(tokens) * 123_456_789n + 50_000_000n) / 10n ** 8n;
    const text = pricing.estimate(
      { inputTokens: tokens, outputTokens: 0 },
      real,
    );
    expect(text).toBe(
      `${(expected / 10_000n).toString()}.${(expected % 10_000n).toString().padStart(4, "0")}`,
    );
  });

  it("gives a string the shared money contract accepts", () => {
    const pricing = new AiPricing({
      inputUsdPerMtok: "3",
      outputUsdPerMtok: "15",
    });
    for (const [input, output] of [
      [0, 0],
      [1, 1],
      [4_321, 987],
      [2_000_000, 500_000],
    ] as const) {
      const text = pricing.estimate(
        { inputTokens: input, outputTokens: output },
        real,
      );
      expect(text).toMatch(DECIMAL_PATTERN);
      expect(text).toMatch(/\.\d{4}$/);
    }
  });

  it.each(["", "-1", "1e3", "0,5", "cheap", "1.1234567", "1234567"])(
    "refuses a price that is not a plain decimal: %j",
    (price) => {
      expect(
        () => new AiPricing({ inputUsdPerMtok: price, outputUsdPerMtok: "0" }),
      ).toThrow(RangeError);
    },
  );

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "refuses token counts that are not whole and non-negative: %s",
    (tokens) => {
      const pricing = new AiPricing({
        inputUsdPerMtok: "1",
        outputUsdPerMtok: "1",
      });
      expect(() =>
        pricing.estimate({ inputTokens: tokens, outputTokens: 0 }, real),
      ).toThrow(RangeError);
    },
  );
});
