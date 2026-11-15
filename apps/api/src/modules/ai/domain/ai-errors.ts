import { DomainError } from "../../../common/domain-error.js";

// Errors of the AI gateway, on the API's own codes: no new code is added. What
// a caller reads (message) is always generic. The detail a person debugging
// needs is a short code on the error, and goes to the usage record and the
// audit row. No error here ever holds a prompt, a document, an answer, a
// response body or a key.

/**
 * The destination check said no. The caller is told only that it was refused:
 * the rule and its reason are for the audit row, because naming the rule tells
 * whoever is probing which data a provider would take (F-1).
 */
export class AiDestinationRefusedError extends DomainError {
  constructor(
    /** The id of the policy rule that refused. Goes to the audit row and the usage record. */
    readonly rule: string,
    /** The policy's wording. Goes to the audit row only. */
    readonly reason: string,
  ) {
    super("FORBIDDEN", "This data may not be sent to the AI provider.");
  }
}

/** How a failed provider request ended, in the words of the usage record's status. */
export type AiFailureOutcome = "error" | "timeout";

/** The model's side failed: unreachable, a bad status, a timeout, or nothing scripted. */
export class AiProviderError extends DomainError {
  constructor(
    /** A short code such as provider-http-429. Never a message from the provider. */
    readonly reasonCode: string,
    readonly outcome: AiFailureOutcome = "error",
    message = "The AI provider could not answer.",
  ) {
    super("UPSTREAM_UNAVAILABLE", message);
  }

  /** From the status of a response. The body is deliberately not a parameter. */
  static fromHttpStatus(status: number): AiProviderError {
    return new AiProviderError(`provider-http-${String(status)}`);
  }

  static timeout(): AiProviderError {
    return new AiProviderError(
      "provider-timeout",
      "timeout",
      "The AI provider took too long to answer.",
    );
  }

  /** The connection never produced a response. */
  static network(): AiProviderError {
    return new AiProviderError("provider-network");
  }
}

/** A mock call for a feature nobody scripted. Loud on purpose: the mock never invents an answer. */
export class AiMockScriptMissingError extends AiProviderError {
  constructor(feature: string) {
    super(
      "mock-script-missing",
      "error",
      `The mock AI provider has no script for the feature "${feature}".`,
    );
  }
}

/** The model's answer did not fit its schema, even after the retries. */
export class AiInvalidOutputError extends DomainError {
  readonly reasonCode = "invalid-output";

  constructor(
    /** Provider requests made before giving up. */
    readonly attempts: number,
  ) {
    super(
      "UPSTREAM_UNAVAILABLE",
      "The AI provider did not return an answer in the expected form.",
    );
  }
}
