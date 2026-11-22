import type { AI_USAGE_STATUSES } from "@orderpilot/shared";
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
    /** The provider's own wait hint (a retry-after header), in milliseconds. */
    readonly retryAfterMs: number | null = null,
  ) {
    super("UPSTREAM_UNAVAILABLE", message);
  }

  /** From the status of a response. The body is deliberately not a parameter. */
  static fromHttpStatus(
    status: number,
    retryAfterMs: number | null = null,
  ): AiProviderError {
    return new AiProviderError(
      `provider-http-${String(status)}`,
      "error",
      "The AI provider could not answer.",
      retryAfterMs,
    );
  }

  static timeout(): AiProviderError {
    return new AiProviderError(
      "provider-timeout",
      "timeout",
      "The AI provider took too long to answer.",
    );
  }

  /** A response arrived, but it is not an answer this gateway can read. */
  static badResponse(): AiProviderError {
    return new AiProviderError("provider-bad-response");
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
  readonly outcome = "error" as const;

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

/** How a call ended, in the words of the usage record's status column. */
export type AiCallOutcome = (typeof AI_USAGE_STATUSES)[number];

/** Every refusal of the gateway's own carries an outcome and a short code, for the usage record. */
interface AiOutcomeError extends Error {
  readonly reasonCode: string;
  readonly outcome: AiCallOutcome;
}

/** The model kept asking for tools past the step cap. A loop that never ends costs money. */
export class AiToolStepsExceededError extends DomainError {
  readonly reasonCode = "tool-steps-exceeded";
  readonly outcome = "error" as const;

  constructor() {
    super(
      "UPSTREAM_UNAVAILABLE",
      "The AI provider asked for too many tool steps.",
    );
  }
}

/**
 * A call with no person behind it was given tools. A tool runs with the
 * asking person's permissions, so a background job has none to run with. This
 * is a bug in the caller, found before anything reaches a provider.
 */
export class AiToolsNeedActorError extends DomainError {
  readonly reasonCode = "tools-need-actor";
  readonly outcome = "refused" as const;

  constructor() {
    super("FORBIDDEN", "A call without a signed-in person cannot use tools.");
  }
}

/**
 * The gateway was called inside a database transaction. A rollback would erase
 * the record of money spent, and a slow call would hold a connection open. No
 * usage record is written: it would join the transaction and be rolled back
 * with it.
 */
export class AiCallInTransactionError extends DomainError {
  readonly reasonCode = "in-transaction";
  readonly outcome = "refused" as const;

  constructor() {
    super(
      "INTERNAL_ERROR",
      "An AI call cannot run inside a database transaction.",
    );
  }
}

/** More page images than the provider takes in one request. */
export class AiImageLimitError extends DomainError {
  readonly reasonCode = "too-many-images";
  readonly outcome = "refused" as const;

  constructor(readonly limit: number) {
    super("VALIDATION_FAILED", "Too many images for one AI request.");
  }
}

function isOutcomeError(error: unknown): error is AiOutcomeError {
  return (
    error instanceof AiToolStepsExceededError ||
    error instanceof AiToolsNeedActorError ||
    error instanceof AiCallInTransactionError ||
    error instanceof AiImageLimitError ||
    error instanceof AiProviderError ||
    error instanceof AiInvalidOutputError
  );
}

/**
 * How a failed call is recorded: a status and a short code, never a message. A
 * failure of a kind this gateway does not know is an `error` with the code
 * "internal", so a bug in a provider adapter never leaks its text.
 */
export function outcomeOfError(error: unknown): {
  readonly outcome: AiCallOutcome;
  readonly reasonCode: string;
} {
  if (error instanceof AiDestinationRefusedError) {
    return { outcome: "refused", reasonCode: error.rule };
  }
  if (isOutcomeError(error)) {
    return { outcome: error.outcome, reasonCode: error.reasonCode };
  }
  return { outcome: "error", reasonCode: "internal" };
}
