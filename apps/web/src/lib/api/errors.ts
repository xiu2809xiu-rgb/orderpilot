import type { ErrorCode, FieldIssue } from "@orderpilot/shared";

/** The API answered with the error envelope. Switch on `code`, never on `message`. */
export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly status: number,
    readonly traceId: string,
    readonly details: FieldIssue[] = [],
  ) {
    super(message);
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
