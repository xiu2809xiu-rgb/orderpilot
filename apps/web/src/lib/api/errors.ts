import type { ErrorCode, FieldIssue } from "@orderpilot/shared";

// The API words these refusals for the person who hit them. Its other messages
// are fixed texts for the log, so a screen uses its own words for those.
const CODES_WORDED_FOR_A_PERSON = new Set<ErrorCode>([
  "VALIDATION_FAILED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
]);

/** The API answered with the error envelope. Switch on `code`, never on `message`. */
export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly traceId: string,
    readonly details: FieldIssue[] = [],
    /** False for an answer that was not our envelope, such as a proxy's page. */
    readonly fromEnvelope = true,
  ) {
    super(message);
  }

  /** The server's own words, when they are meant for a person. */
  get personMessage(): string | undefined {
    return this.fromEnvelope && CODES_WORDED_FOR_A_PERSON.has(this.code)
      ? this.message
      : undefined;
  }
}

/** The request never got an answer: offline, refused, or timed out. */
export class NetworkError extends Error {
  override readonly name = "NetworkError";

  constructor(
    message: string,
    readonly traceId: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** The answer did not match the shared contract. A bug on one side, never user input. */
export class ContractError extends Error {
  override readonly name = "ContractError";

  constructor(
    message: string,
    readonly traceId: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

/** The trace id a person can quote, whatever the error type. */
export function traceIdOf(error: unknown): string | undefined {
  if (
    error instanceof ApiError ||
    error instanceof NetworkError ||
    error instanceof ContractError
  ) {
    return error.traceId;
  }
  return undefined;
}
