import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { HEADERS } from "@orderpilot/shared";

/** Letters, digits and a few separators, so a caller cannot forge a log line or a header. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * The request id is the caller's X-Request-Id when it is safe, else a new
 * UUID. It goes on the response, in every log line (as `requestId`), and in
 * the error envelope as `traceId`: one id to quote for one request.
 */
export function resolveRequestId(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const sent = req.headers[HEADERS.requestId.toLowerCase()];
  const candidate = Array.isArray(sent) ? sent[0] : sent;
  const id =
    candidate !== undefined && SAFE_REQUEST_ID.test(candidate)
      ? candidate
      : randomUUID();
  res.setHeader(HEADERS.requestId, id);
  return id;
}

/** The id for a request that has one, for code outside the logger. */
export function requestIdOf(req: { id?: unknown }): string {
  return typeof req.id === "string" && req.id.length > 0
    ? req.id
    : randomUUID();
}
