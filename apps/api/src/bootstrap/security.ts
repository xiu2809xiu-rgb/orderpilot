import type { NestExpressApplication } from "@nestjs/platform-express";
import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { DOCS_PATH } from "../common/api-paths.js";
import type { AppConfig } from "../config/app-config.js";

/**
 * API responses are JSON, so nothing may load or frame anything. helmet merges
 * its own defaults into a policy unless told not to; `useDefaults: false`
 * keeps exactly these four.
 */
const strictHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
});

/**
 * Swagger UI needs its own scripts, styles and images, and inline styles. It
 * is the only route with this policy, and it is off in production by default.
 */
const docsHelmet = helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
});

const docsPrefix = `/${DOCS_PATH}`;

function isDocsRequest(path: string): boolean {
  return (
    path === docsPrefix ||
    path.startsWith(`${docsPrefix}/`) ||
    path === `${docsPrefix}-json`
  );
}

export function applySecurity(
  app: NestExpressApplication,
  config: AppConfig,
): void {
  app.set("trust proxy", config.http.trustProxyHops);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const policy =
      config.http.swaggerEnabled && isDocsRequest(req.path)
        ? docsHelmet
        : strictHelmet;
    policy(req, res, next);
  });

  const allowed = new Set(config.http.corsOrigins);
  app.enableCors({
    // A request with no Origin (curl, server to server) is not a browser
    // cross-origin call, so CORS does not apply. Any other origin must be on
    // the list; an unlisted one gets no CORS headers and the browser blocks it.
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      callback(null, origin === undefined || allowed.has(origin));
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: [
      "Content-Type",
      "X-CSRF-Token",
      "X-Request-Id",
      "Idempotency-Key",
    ],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
    maxAge: 600,
  });
}
