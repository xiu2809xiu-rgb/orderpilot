import {
  ERROR_HTTP_STATUS,
  type ErrorCode,
  type FieldIssue,
} from "@orderpilot/shared";

/**
 * A business rule said no. Domain classes and services throw these; they know
 * nothing about HTTP. The exception filter turns one into the error envelope.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: FieldIssue[] | null = null,
  ) {
    super(message);
    this.name = new.target.name;
  }

  get httpStatus(): number {
    return ERROR_HTTP_STATUS[this.code];
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super("NOT_FOUND", `${what} was not found.`);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("CONFLICT", message);
  }
}

export class ValidationFailedError extends DomainError {
  constructor(details: FieldIssue[]) {
    super("VALIDATION_FAILED", "The request is not valid.", details);
  }
}

export class UpstreamUnavailableError extends DomainError {
  constructor(message: string) {
    super("UPSTREAM_UNAVAILABLE", message);
  }
}
