import { describe, expect, it } from "vitest";
import { DomainError } from "../../../common/domain-error.js";
import {
  AiCallInTransactionError,
  AiDestinationRefusedError,
  AiImageLimitError,
  AiInvalidOutputError,
  AiMockScriptMissingError,
  AiProviderError,
  AiToolStepsExceededError,
  AiToolsNeedActorError,
  outcomeOfError,
} from "./ai-errors.js";

describe("a refused destination", () => {
  const error = new AiDestinationRefusedError(
    "default-synthetic-only",
    "real data may not go to openai-compatible providers",
  );

  it("is a 403 FORBIDDEN on the API's own code", () => {
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("FORBIDDEN");
    expect(error.httpStatus).toBe(403);
    expect(error.name).toBe("AiDestinationRefusedError");
  });

  it("keeps the rule and the reason off the message the caller reads", () => {
    expect(error.message).toBe("This data may not be sent to the AI provider.");
    expect(error.message).not.toContain("default-synthetic-only");
    expect(error.message).not.toContain("openai-compatible");
    expect(error.details).toBeNull();
  });

  it("still carries them, for the audit row", () => {
    expect(error.rule).toBe("default-synthetic-only");
    expect(error.reason).toContain("real data");
  });
});

describe("a provider failure", () => {
  it("is a 503 UPSTREAM_UNAVAILABLE with a short reason code", () => {
    const error = AiProviderError.fromHttpStatus(429);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(error.httpStatus).toBe(503);
    expect(error.reasonCode).toBe("provider-http-429");
    expect(error.outcome).toBe("error");
  });

  it("says nothing of the provider's reply in its message", () => {
    const error = AiProviderError.fromHttpStatus(500);
    expect(error.message).toBe("The AI provider could not answer.");
    expect(error.message).not.toContain("500");
  });

  it("tells a timeout from other failures, for the usage record's status", () => {
    const error = AiProviderError.timeout();
    expect(error.outcome).toBe("timeout");
    expect(error.reasonCode).toBe("provider-timeout");
    expect(AiProviderError.network().reasonCode).toBe("provider-network");
    expect(AiProviderError.network().outcome).toBe("error");
  });
});

describe("a feature with no mock script", () => {
  it("names the feature, so the gap is found at once", () => {
    const error = new AiMockScriptMissingError("document-extraction");
    expect(error).toBeInstanceOf(AiProviderError);
    expect(error.message).toContain('"document-extraction"');
    expect(error.reasonCode).toBe("mock-script-missing");
    expect(error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("an answer that stays invalid", () => {
  it("is UPSTREAM_UNAVAILABLE with a code and the attempts made", () => {
    const error = new AiInvalidOutputError(3);
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(error.reasonCode).toBe("invalid-output");
    expect(error.attempts).toBe(3);
    expect(error.message).not.toContain("3");
  });
});

describe("how a failed call is recorded", () => {
  it.each([
    [new AiDestinationRefusedError("rule-1", "why"), "refused", "rule-1"],
    [AiProviderError.fromHttpStatus(429), "error", "provider-http-429"],
    [AiProviderError.timeout(), "timeout", "provider-timeout"],
    [new AiInvalidOutputError(3), "error", "invalid-output"],
    [new AiToolStepsExceededError(), "error", "tool-steps-exceeded"],
    [new AiToolsNeedActorError(), "refused", "tools-need-actor"],
    [new AiImageLimitError(3), "refused", "too-many-images"],
    [new AiCallInTransactionError(), "refused", "in-transaction"],
  ] as const)("%s as %s with the code %s", (error, outcome, reasonCode) => {
    expect(outcomeOfError(error)).toEqual({ outcome, reasonCode });
  });

  it("records a failure it does not know as an internal error, never its message", () => {
    expect(outcomeOfError(new TypeError("password=hunter2"))).toEqual({
      outcome: "error",
      reasonCode: "internal",
    });
    expect(outcomeOfError("a string")).toEqual({
      outcome: "error",
      reasonCode: "internal",
    });
  });

  it("keeps every message generic", () => {
    for (const error of [
      new AiToolStepsExceededError(),
      new AiToolsNeedActorError(),
      new AiImageLimitError(3),
      new AiCallInTransactionError(),
    ]) {
      expect(error.message).not.toMatch(/[0-9]/);
      expect(error.message).not.toContain(error.reasonCode);
    }
  });
});
