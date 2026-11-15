import { request } from "@playwright/test";
import { HEADERS, type Role } from "@orderpilot/shared";
import { apiUrl, ORIGIN } from "./env.js";
import type { Method } from "./refusals.js";
import { csrfToken, sessionFor } from "./session.js";

/**
 * Calls the API as `role`, with that role's session cookies and its CSRF
 * token, for a spec that needs a record to exist before it opens a page.
 * Returns the status and the body; the spec parses the body with the shared
 * schema, as the app does.
 */
export async function callAs(
  role: Role,
  method: Method,
  route: string,
  body?: unknown,
): Promise<{ status: number; body: unknown }> {
  const session = await sessionFor(role);
  const api = await request.newContext({ storageState: session });
  try {
    const res = await api.fetch(apiUrl(route), {
      method,
      ...(body === undefined ? {} : { data: body }),
      headers: { Origin: ORIGIN, [HEADERS.csrf]: csrfToken(session) },
    });
    return { status: res.status(), body: (await res.json()) as unknown };
  } finally {
    await api.dispose();
  }
}
