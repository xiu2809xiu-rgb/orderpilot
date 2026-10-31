import {
  Catch,
  HttpException,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import {
  errorEnvelopeSchema,
  type ErrorCode,
  type ErrorEnvelope,
  type FieldIssue,
} from "@orderpilot/shared";
import type { Request, Response } from "express";
import { DomainError } from "./domain-error.js";
import { captureServerError } from "../telemetry/sentry.js";
import { requestIdOf } from "./request-id.js";

const GENERIC_MESSAGE = "Something went wrong. Quote the trace id to support.";

export interface RenderedError {
  readonly status: number;
  readonly body: ErrorEnvelope;
}

/**
 * Turns any failure into the one error envelope: domain errors, HTTP
 * exceptions (404, 429, ...), body-parser errors and plain bugs. A bug never
 * shows its message or stack to the caller.
 *
 * Pure, so the filter and the Express-level 404 handler share it.
 */
export function renderError(
  exception: unknown,
  traceId: string,
): RenderedError {
  const { status, code, message, details } = describe(exception);
  const body: ErrorEnvelope = { error: { code, message, details, traceId } };
  // The shape is the contract with the web app: fail loudly in tests if it drifts.
  errorEnvelopeSchema.parse(body);
  return { status, body };
}

/** Catches everything, so no failure leaves the API in any other shape. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const traceId = requestIdOf(req);

    const { status, body } = renderError(exception, traceId);
    if (status >= 500) {
      // The caller gets a generic message; the cause is logged against the trace id.
      this.logger.error({ traceId, err: exception }, "Request failed");
      captureServerError(exception, traceId);
    }
    if (res.headersSent) return;
    res.status(status).json(body);
  }
}

interface Description {
  status: number;
  code: ErrorCode;
  message: string;
  details: FieldIssue[] | null;
}

function describe(exception: unknown): Description {
  if (exception instanceof DomainError) {
    return {
      status: exception.httpStatus,
      code: exception.code,
      message: exception.message,
      details: exception.details,
    };
  }
  const status = statusOf(exception);
  if (status !== null && status < 500) {
    const code = codeForStatus(status);
    return {
      status,
      code,
      message: clientMessage(exception, status, code),
      details: null,
    };
  }
  if (status === 503) {
    return {
      status,
      code: "UPSTREAM_UNAVAILABLE",
      message: "A service this API depends on is not available.",
      details: null,
    };
  }
  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: GENERIC_MESSAGE,
    details: null,
  };
}

/** Nest's HttpException, or a body-parser error (http-errors) that carries a status. */
function statusOf(exception: unknown): number | null {
  if (exception instanceof HttpException) return exception.getStatus();
  if (typeof exception === "object" && exception !== null) {
    const { status, statusCode } = exception as {
      status?: unknown;
      statusCode?: unknown;
    };
    const candidate = status ?? statusCode;
    if (
      typeof candidate === "number" &&
      Number.isInteger(candidate) &&
      candidate >= 400 &&
      candidate < 600
    ) {
      return candidate;
    }
  }
  return null;
}

function codeForStatus(status: number): ErrorCode {
  switch (status) {
    case 401:
      return "UNAUTHENTICATED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 429:
      return "RATE_LIMITED";
    default:
      return "VALIDATION_FAILED";
  }
}

/** Fixed texts: an exception's own message could carry a path, a header or a value. */
function clientMessage(
  exception: unknown,
  status: number,
  code: ErrorCode,
): string {
  if (code === "NOT_FOUND") return "The resource was not found.";
  if (code === "RATE_LIMITED") return "Too many requests. Try again shortly.";
  if (code === "UNAUTHENTICATED") return "You are not signed in.";
  if (code === "FORBIDDEN") return "You are not allowed to do this.";
  if (code === "CONFLICT")
    return "The request conflicts with the current state.";
  if (status === 413) return "The request body is too large.";
  if (status === 400 && !(exception instanceof HttpException)) {
    return "The request body could not be read.";
  }
  return "The request is not valid.";
}
