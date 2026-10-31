import type * as SentryBrowser from "@sentry/browser";

type SentryModule = typeof SentryBrowser;
type ErrorEvent = SentryBrowser.ErrorEvent;

/**
 * Sentry in the browser (ADR 0022). The SDK is a separate chunk loaded by a
 * dynamic import, and only when VITE_SENTRY_DSN is set: without a DSN nothing
 * is downloaded, nothing is patched and nothing is sent, and the entry bundle
 * stays inside its budget.
 */
let loaded: SentryModule | null = null;

export interface WebSentryOptions {
  /** Tests swap the dynamic import for a fake module. */
  readonly loader?: () => Promise<SentryModule>;
  /** Tests swap the network for a function that records what would be sent. */
  readonly transport?: NonNullable<
    Parameters<SentryModule["init"]>[0]
  >["transport"];
  readonly environment?: string;
}

/**
 * Removes the cookies, headers, request body, query string and user from an
 * event, so only the error, its stack and the page path remain.
 */
export function scrubBrowserEvent<T extends ErrorEvent>(event: T): T {
  if (event.request !== undefined) {
    const { url } = event.request;
    event.request = url === undefined ? {} : { url: withoutQuery(url) };
  }
  delete event.user;
  return event;
}

function withoutQuery(url: string): string {
  const cut = url.search(/[?#]/);
  return cut === -1 ? url : url.slice(0, cut);
}

/** Returns true when Sentry was started. With no DSN it returns false and loads nothing. */
export async function initWebSentry(
  dsn: string | undefined,
  options: WebSentryOptions = {},
): Promise<boolean> {
  if (dsn === undefined || dsn === "") return false;
  const sentry = await (options.loader ?? (() => import("@sentry/browser")))();
  sentry.init({
    dsn,
    ...(options.environment === undefined
      ? {}
      : { environment: options.environment }),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    // Errors only: no clicks, console lines or requests as breadcrumbs, no tracing.
    defaultIntegrations: false,
    integrations: [
      sentry.globalHandlersIntegration(),
      sentry.linkedErrorsIntegration(),
      sentry.dedupeIntegration(),
    ],
    tracesSampleRate: 0,
    beforeSend: (event) => scrubBrowserEvent(event),
    ...(options.transport === undefined
      ? {}
      : { transport: options.transport }),
  });
  loaded = sentry;
  return true;
}

/** Reports an error the router caught. A no-op unless Sentry was started. */
export function reportWebError(error: unknown): void {
  loaded?.captureException(error);
}
