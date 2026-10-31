import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { RequestHandler } from "express";
import pino, { type DestinationStream, type Logger as PinoLogger } from "pino";
import { pinoHttp } from "pino-http";
import { requestIdOf, resolveRequestId } from "../common/request-id.js";
import type { AppConfig } from "../config/app-config.js";
import { traceIdOf } from "../telemetry/trace-context.js";

/**
 * Headers and cookies that must never reach a log line. Paths use pino's
 * redaction syntax; the headers are lower case because Node lower-cases them.
 */
export const REDACTED_PATHS = [
  "req.headers.cookie",
  "req.headers.authorization",
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
];

/** The root logger: JSON, one object per line, to stdout unless a test gives a stream. */
export function createRootLogger(
  config: AppConfig,
  stream?: DestinationStream,
): PinoLogger {
  return pino(
    {
      level: config.logLevel,
      redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
    },
    stream,
  );
}

/**
 * The logger of the request being handled, so a line written anywhere under a
 * request (a service, a repository) carries the same `requestId` as the
 * request's own log line and the error envelope's `traceId`.
 */
const requestLogger = new AsyncLocalStorage<PinoLogger>();

export function currentLogger(root: PinoLogger): PinoLogger {
  return requestLogger.getStore() ?? root;
}

/**
 * Express middleware, installed first so it sees every request, including the
 * ones no route takes. It writes one JSON line per request when the response
 * finishes, and puts the id on the response as X-Request-Id.
 */
export function requestLogging(root: PinoLogger): RequestHandler[] {
  const http = pinoHttp({
    logger: root,
    genReqId: (req: IncomingMessage, res: ServerResponse) =>
      resolveRequestId(req, res),
    // The request id as a top-level field, easy to search for in any log tool,
    // and the trace id beside it so a log line finds its trace in Grafana.
    customProps: (req) => ({
      requestId: requestIdOf(req),
      ...traceFields(traceIdOf(req)),
    }),
    customLogLevel: (_req, res, error) => {
      if (error || res.statusCode >= 500) return "error";
      if (res.statusCode >= 400) return "warn";
      return "info";
    },
  });
  const bind: RequestHandler = (req, _res, next) => {
    requestLogger.run(
      req.log.child({
        requestId: requestIdOf(req),
        ...traceFields(traceIdOf(req)),
      }),
      next,
    );
  };
  return [http as RequestHandler, bind];
}

function traceFields(traceId: string | undefined): { traceId?: string } {
  return traceId === undefined ? {} : { traceId };
}
