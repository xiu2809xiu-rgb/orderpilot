import {
  COOKIES,
  ERROR_HTTP_STATUS,
  HEADERS,
  apiPath,
  authRoutes,
  errorEnvelopeSchema,
  type ErrorCode,
  type Session,
} from "@orderpilot/shared";
import { z } from "zod";
import { ApiError, ContractError, NetworkError } from "./errors";
import { readCookie as readDocumentCookie } from "./cookies";

/** The shape of a route in `@orderpilot/shared` (authRoutes and the routes to come). */
export interface RouteLike<
  Req extends z.ZodType | null,
  Res extends z.ZodType,
> {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  /** True when `path` is already the full URL (a generated hook has it). */
  absolute?: boolean;
  /** Cancels the call (TanStack Query passes one when a query is dropped). */
  signal?: AbortSignal;
  csrf: boolean;
  request: Req;
  response: Res;
}

export interface ApiClientOptions {
  fetch?: typeof fetch;
  readCookie?: (name: string) => string | undefined;
  newRequestId?: () => string;
  /** The refresh failed: the session is over. */
  onSessionEnded?: () => void;
  /** A refresh worked, so the store can take the new expiry. */
  onSessionRefreshed?: (session: Session) => void;
  timeoutMs?: number;
}

type CallArgs<Req extends z.ZodType | null> = Req extends z.ZodType
  ? [body: z.input<Req>]
  : [];

// These never trigger a refresh: they are how a session starts or ends.
const NO_REFRESH = new Set<string>([
  authRoutes.options.path,
  authRoutes.demoLogin.path,
  authRoutes.login.path,
  authRoutes.refresh.path,
  authRoutes.logout.path,
]);

const STATUS_TO_CODE: Record<number, ErrorCode> = Object.fromEntries(
  Object.entries(ERROR_HTTP_STATUS)
    .reverse()
    .map(([code, status]) => [status, code as ErrorCode]),
);

/**
 * The one way the web app talks to the API. It copies the CSRF cookie into the
 * header, refreshes an expired access token once for all callers at the same
 * time, validates every answer with the shared zod schemas, and throws errors
 * that carry the trace id.
 */
export class ApiClient {
  readonly #fetch: typeof fetch;
  readonly #readCookie: (name: string) => string | undefined;
  readonly #newRequestId: () => string;
  readonly #options: ApiClientOptions;
  #sessionStarted = false;
  #sessionEnded = false;
  #refreshing: Promise<boolean> | null = null;

  constructor(options: ApiClientOptions = {}) {
    this.#options = options;
    // Looked up at call time, so a test can swap the global.
    this.#fetch = options.fetch ?? ((...args) => globalThis.fetch(...args));
    this.#readCookie = options.readCookie ?? readDocumentCookie;
    this.#newRequestId = options.newRequestId ?? (() => crypto.randomUUID());
  }

  /** Call after a sign-in, `me` or refresh worked. */
  markSessionStarted(): void {
    this.#sessionStarted = true;
    this.#sessionEnded = false;
  }

  /** Back to a fresh page load: nothing started, nothing ended. For tests. */
  reset(): void {
    this.#sessionStarted = false;
    this.#sessionEnded = false;
    this.#refreshing = null;
  }

  /** Call after sign-out or when the session ended. */
  markSessionEnded(): void {
    this.#sessionStarted = false;
    this.#sessionEnded = true;
  }

  /**
   * True when a session was started here, or the readable CSRF cookie says one
   * exists (after a reload). With neither there is nothing to refresh, and once
   * a session has ended nothing is tried until a new sign-in.
   */
  hasSession(): boolean {
    if (this.#sessionEnded) return false;
    return this.#sessionStarted || this.#readCookie(COOKIES.csrf) !== undefined;
  }

  async call<Req extends z.ZodType | null, Res extends z.ZodType>(
    route: RouteLike<Req, Res>,
    ...args: CallArgs<Req>
  ): Promise<z.output<Res>> {
    const body: unknown = args[0];
    try {
      return await this.#send(route, body);
    } catch (error) {
      if (!this.#shouldRefresh(route, error)) throw error;
      if (!(await this.refresh())) throw error;
      return this.#send(route, body);
    }
  }

  /**
   * A call by URL, for generated hooks (src/lib/api/mutator.ts). It takes the
   * same road as `call`: CSRF, refresh, request id, typed errors. The answer
   * is typed by the OpenAPI document and is not parsed again.
   */
  request<T>(options: {
    method: RouteLike<z.ZodType, z.ZodType>["method"];
    url: string;
    body?: unknown;
    signal?: AbortSignal;
  }): Promise<T> {
    const route = {
      method: options.method,
      path: options.url,
      absolute: true,
      signal: options.signal,
      csrf: options.method !== "GET",
      request: options.body === undefined ? null : z.unknown(),
      response: z.unknown(),
    };
    return (
      options.body === undefined
        ? this.call(route)
        : this.call(route, options.body)
    ) as Promise<T>;
  }

  /** Refreshes the session. Callers at the same time share one request. */
  refresh(): Promise<boolean> {
    this.#refreshing ??= this.#send(authRoutes.refresh, undefined)
      .then((response) => {
        this.markSessionStarted();
        this.#options.onSessionRefreshed?.(response.data);
        return true;
      })
      .catch(() => {
        this.markSessionEnded();
        this.#options.onSessionEnded?.();
        return false;
      })
      .finally(() => {
        this.#refreshing = null;
      });
    return this.#refreshing;
  }

  #shouldRefresh(
    route: RouteLike<z.ZodType | null, z.ZodType>,
    error: unknown,
  ): boolean {
    return (
      error instanceof ApiError &&
      error.status === 401 &&
      !NO_REFRESH.has(route.path) &&
      this.hasSession()
    );
  }

  async #send<Req extends z.ZodType | null, Res extends z.ZodType>(
    route: RouteLike<Req, Res>,
    body: unknown,
  ): Promise<z.output<Res>> {
    const requestId = this.#newRequestId();
    const headers: Record<string, string> = {
      Accept: "application/json",
      [HEADERS.requestId]: requestId,
    };
    let payload: string | undefined;
    if (route.request) {
      const parsed = route.request.safeParse(body);
      if (!parsed.success) {
        throw new ContractError(
          "The request does not match the contract.",
          requestId,
          { cause: parsed.error },
        );
      }
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(parsed.data);
    }
    if (route.csrf || route.method !== "GET") {
      const token = this.#readCookie(COOKIES.csrf);
      if (token) headers[HEADERS.csrf] = token;
    }

    let response: Response;
    try {
      response = await this.#fetch(
        route.absolute ? route.path : apiPath(route.path),
        {
          method: route.method,
          headers,
          body: payload,
          credentials: "same-origin",
          signal: AbortSignal.any([
            AbortSignal.timeout(this.#options.timeoutMs ?? 15_000),
            ...(route.signal ? [route.signal] : []),
          ]),
        },
      );
    } catch (cause) {
      throw new NetworkError("The API did not answer.", requestId, { cause });
    }

    const traceId = response.headers.get(HEADERS.requestId) ?? requestId;
    const text = await response.text();
    const json: unknown = parseJson(text);

    if (!response.ok) throw toApiError(response.status, json, traceId);

    const result = route.response.safeParse(json);
    if (!result.success) {
      throw new ContractError(
        "The answer does not match the contract.",
        traceId,
        { cause: result.error },
      );
    }
    return result.data;
  }
}

function parseJson(text: string): unknown {
  if (text === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function toApiError(status: number, json: unknown, traceId: string): ApiError {
  const envelope = errorEnvelopeSchema.safeParse(json);
  if (envelope.success) {
    const { code, message, details } = envelope.data.error;
    return new ApiError(
      code,
      message,
      status,
      envelope.data.error.traceId,
      details ?? [],
    );
  }
  // Not our envelope (a proxy page, say): keep the status and the trace id.
  const code = STATUS_TO_CODE[status] ?? "INTERNAL_ERROR";
  return new ApiError(code, "Unexpected response.", status, traceId);
}
