import { describe, expect, it } from "vitest";
import {
  AiCallInTransactionError,
  AiDestinationRefusedError,
  AiInvalidOutputError,
  AiMockScriptMissingError,
  AiProviderError,
  AiToolStepsExceededError,
  AiToolsNeedActorError,
} from "../../ai/domain/ai-errors.js";
import { failureOf } from "./spark-failure.js";

describe("how a failed gateway call is stored", () => {
  it("says refused for a destination refusal, and keeps the rule for the audit row only", () => {
    const failure = failureOf(
      new AiDestinationRefusedError("real-data-to-provider", "a reason"),
    );
    expect(failure).toEqual({
      code: "refused",
      outcome: "refused",
      reasonCode: "real-data-to-provider",
    });
  });

  it("reduces the gateway's outcomes to the short list a person may be told", () => {
    const cases: [unknown, string][] = [
      [AiProviderError.timeout(), "timeout"],
      [AiProviderError.fromHttpStatus(429), "provider-error"],
      [AiProviderError.badResponse(), "provider-error"],
      [AiProviderError.network(), "provider-error"],
      [new AiMockScriptMissingError("spark"), "provider-error"],
      [new AiInvalidOutputError(3), "invalid-output"],
      [new AiToolStepsExceededError(), "too-many-steps"],
      [new AiToolsNeedActorError(), "internal"],
      [new AiCallInTransactionError(), "internal"],
      [new RangeError("A call needs a message."), "internal"],
      [new Error("a driver blew up"), "internal"],
      ["a thrown string", "internal"],
    ];
    for (const [error, code] of cases) {
      expect(failureOf(error).code, String(error)).toBe(code);
    }
  });

  it("uses the gateway's own outcome and reason code", () => {
    expect(failureOf(AiProviderError.timeout())).toMatchObject({
      outcome: "timeout",
      reasonCode: "provider-timeout",
    });
    expect(failureOf(AiProviderError.fromHttpStatus(503))).toMatchObject({
      outcome: "error",
      reasonCode: "provider-http-503",
    });
  });

  it("never carries a message", () => {
    const failure = failureOf(new Error("secret text from a provider"));
    expect(JSON.stringify(failure)).not.toContain("secret text");
  });
});
