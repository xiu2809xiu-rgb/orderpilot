import * as Sentry from "@sentry/node";
import type { AppConfig } from "../config/app-config.js";

/**
 * Removes what must never leave the building: cookies, every header (the
 * authorisation and CSRF ones among them), the request body, the query string
 * and the user. What stays is the error, its stack and the request id tag
 * (ADR 0022).
 */
export function scrubSentryEvent<T extends Sentry.ErrorEvent>(event: T): T {
  if (event.request !== undefined) {
    const { url, method } = event.request;
    event.request = {
      ...(method === undefined ? {} : { method }),
      ...(url === undefined ? {} : { url: withoutQuery(url) }),
    };
  }
  delete event.user;
  return event;
}

function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

export interface SentryOptions {
  /** Tests swap the network for a function that records what would be sent. */
  readonly transport?: Sentry.NodeOptions["transport"];
}

/**
 * Starts Sentry for the API, only when SENTRY_DSN is set. Without it this does
 * nothing at all: no client, no network, no patched globals. With it, only
 * errors are reported: no default integrations, no tracing (OpenTelemetry
 * already does that), no personal data by default.
 */
export function initSentry(
  config: AppConfig,
  options: SentryOptions = {},
): boolean {
  const dsn = config.monitoring.sentryDsn;
  if (dsn === null) return false;
  Sentry.init({
    dsn,
    environment: config.appEnv,
    ...(config.gitSha === null ? {} : { release: config.gitSha }),
    // Nothing that could name a person or carry a secret is collected; the
    // scrub below is the second lock on the same door.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      stackFrameVariables: false,
      genAI: { inputs: false, outputs: false },
    },
    defaultIntegrations: false,
    integrations: [],
    // OpenTelemetry is ours: Sentry must not install a provider or patch modules.
    enableOpenTelemetrySetup: false,
    enableRuntimeChannelInjection: false,
    tracesSampleRate: 0,
    beforeSend: (event) => scrubSentryEvent(event),
    ...(options.transport === undefined
      ? {}
      : { transport: options.transport }),
  });
  return true;
}

/** Reports a server error with its request id. A no-op until initSentry has run. */
export function captureServerError(error: unknown, requestId: string): void {
  if (Sentry.getClient() === undefined) return;
  Sentry.withScope((scope) => {
    scope.setTag("request_id", requestId);
    Sentry.captureException(error);
  });
}

export async function closeSentry(): Promise<void> {
  await Sentry.close(2000);
}
