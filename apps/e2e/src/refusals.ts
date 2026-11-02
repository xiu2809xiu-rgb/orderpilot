import { randomUUID } from "node:crypto";
import { expect, request, type Page } from "@playwright/test";
import { errorEnvelopeSchema, HEADERS, type Role } from "@orderpilot/shared";
import { apiUrl, ORIGIN } from "./env.js";
import { csrfToken, sessionFor } from "./session.js";

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * The server side of a refusal: calls the API itself as `role`, with that
 * role's session cookies and its CSRF token, and asserts a 403 FORBIDDEN in
 * the standard error envelope, carrying this call's request id as its trace
 * id. No page is involved, so a hidden button cannot make it pass.
 *
 * `route` is the API route, such as "/governance/matrix/copy". `body` is sent
 * as JSON. Send a body the route would accept, so the 403 cannot be a
 * validation failure in disguise.
 */
export async function expectRefused(
  role: Role,
  method: Method,
  route: string,
  body?: unknown,
): Promise<void> {
  const session = await sessionFor(role);
  const api = await request.newContext({ storageState: session });
  const requestId = `e2e-${randomUUID()}`;
  try {
    const res = await api.fetch(apiUrl(route), {
      method,
      ...(body === undefined ? {} : { data: body }),
      headers: {
        Origin: ORIGIN,
        [HEADERS.csrf]: csrfToken(session),
        [HEADERS.requestId]: requestId,
      },
    });
    const call = `${role} ${method} ${route}`;
    expect(res.status(), `${call} should be refused`).toBe(403);
    const envelope = errorEnvelopeSchema.parse(await res.json());
    expect(envelope.error.code, `${call} refusal code`).toBe("FORBIDDEN");
    expect(envelope.error.traceId, `${call} trace id`).toBe(requestId);
  } finally {
    await api.dispose();
  }
}

/**
 * The screen side of the same proof: no button with this accessible name.
 * It waits for the page to finish loading first, so it cannot pass on a page
 * that has not drawn yet. Pass role "link" for a link styled as a button.
 * Show in the same spec that an allowed role does see it, or the name may
 * simply be wrong.
 */
export async function expectNoButton(
  page: Page,
  name: string | RegExp,
  role: "button" | "link" | "menuitem" = "button",
): Promise<void> {
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole(role, { name })).toHaveCount(0);
}
