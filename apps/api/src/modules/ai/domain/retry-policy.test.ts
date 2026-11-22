import { describe, expect, it } from "vitest";
import { AiProviderError } from "./ai-errors.js";
import { RetryPolicy } from "./retry-policy.js";

const policy = new RetryPolicy({
  baseDelayMs: 500,
  maxDelayMs: 8_000,
  maxRetryAfterMs: 30_000,
});

describe("which failures are retried", () => {
  it.each([408, 425, 429, 500, 502, 503, 504, 529])(
    "retries HTTP %i",
    (status) => {
      expect(policy.isTransient(AiProviderError.fromHttpStatus(status))).toBe(
        true,
      );
    },
  );

  it("retries a connection that never answered", () => {
    expect(policy.isTransient(AiProviderError.network())).toBe(true);
  });

  it.each([400, 401, 403, 404, 413, 422])(
    "does not retry HTTP %i",
    (status) => {
      expect(policy.isTransient(AiProviderError.fromHttpStatus(status))).toBe(
        false,
      );
    },
  );

  it("does not retry a timeout, a missing mock script or an error of another kind", () => {
    expect(policy.isTransient(AiProviderError.timeout())).toBe(false);
    expect(policy.isTransient(new AiProviderError("mock-script-missing"))).toBe(
      false,
    );
    expect(policy.isTransient(new AiProviderError("provider-http-4xx"))).toBe(
      false,
    );
    expect(policy.isTransient(new TypeError("boom"))).toBe(false);
  });
});

describe("how long to wait", () => {
  const error = AiProviderError.fromHttpStatus(503);

  it("doubles up to the cap, with the random source choosing between half and all", () => {
    expect(policy.delayMs(error, 1, () => 1)).toBe(500);
    expect(policy.delayMs(error, 1, () => 0)).toBe(250);
    expect(policy.delayMs(error, 2, () => 1)).toBe(1_000);
    expect(policy.delayMs(error, 3, () => 1)).toBe(2_000);
    expect(policy.delayMs(error, 5, () => 1)).toBe(8_000);
    // Capped: 500 * 2^9 would be 256 s.
    expect(policy.delayMs(error, 10, () => 1)).toBe(8_000);
    expect(policy.delayMs(error, 10, () => 0)).toBe(4_000);
  });

  it("respects the provider's retry-after hint, up to its cap", () => {
    expect(
      policy.delayMs(AiProviderError.fromHttpStatus(429, 2_000), 1, () => 0),
    ).toBe(2_000);
    expect(
      policy.delayMs(AiProviderError.fromHttpStatus(429, 600_000), 1, () => 0),
    ).toBe(30_000);
    expect(
      policy.delayMs(AiProviderError.fromHttpStatus(429, 0), 1, () => 0.5),
    ).toBe(0);
  });
});
