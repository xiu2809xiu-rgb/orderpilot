import type { ApiError } from "./errors";
import { apiClient } from "./instance";

/** What the generated code hands over for each call. */
export interface MutatorConfig {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  params?: object;
  data?: unknown;
  signal?: AbortSignal;
}

/**
 * The one door for generated hooks (orval's `mutator`). The request goes
 * through the app's ApiClient, so it carries the CSRF header and the request
 * id, refreshes an expired session once, and fails with an ApiError that holds
 * the traceId. The answer is typed by the OpenAPI document, not parsed again.
 */
export function apiMutator<T>(config: MutatorConfig): Promise<T> {
  return apiClient.request<T>({
    method: config.method,
    url: withQuery(config.url, config.params),
    body: config.data,
    signal: config.signal,
  });
}

/** The error type of a generated hook. */
export type ErrorType<Body> = ApiError & { readonly body?: Body };

/** An array becomes repeated keys, the form a list filter expects. */
export function withQuery(
  url: string,
  params: MutatorConfig["params"],
): string {
  if (!params) return url;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(name, String(item));
      continue;
    }
    query.set(
      name,
      typeof value === "object" ? JSON.stringify(value) : String(value),
    );
  }
  const text = query.toString();
  return text === "" ? url : `${url}?${text}`;
}
