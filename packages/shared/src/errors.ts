import { z } from "zod";

/** Every error code the API returns. The web app switches on these, never on the message. */
export const ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "INVALID_CREDENTIALS",
  "SESSION_EXPIRED",
  "REFRESH_REUSED",
  "FORBIDDEN",
  "CSRF_INVALID",
  "DEMO_MODE_DISABLED",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "UPSTREAM_UNAVAILABLE",
  "INTERNAL_ERROR",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** The HTTP status each code is sent with. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  INVALID_CREDENTIALS: 401,
  SESSION_EXPIRED: 401,
  REFRESH_REUSED: 401,
  FORBIDDEN: 403,
  CSRF_INVALID: 403,
  DEMO_MODE_DISABLED: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

/** One problem with one field, listed in `details` for VALIDATION_FAILED. */
export const fieldIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});
export type FieldIssue = z.infer<typeof fieldIssueSchema>;

/** `{ error: { code, message, details, traceId } }`: the only shape an error takes. */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    // `null` when there is nothing to add. Never a stack trace.
    details: z.array(fieldIssueSchema).nullable(),
    // The request id. A person quotes it to find the log line.
    traceId: z.string().min(1),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
