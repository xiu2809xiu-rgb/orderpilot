import { COOKIES, HEADERS, type Role, type Session } from "@orderpilot/shared";
import request from "supertest";
import { AuditEventRepository } from "../../src/audit/audit-event.repository.js";
import { TEST_DEMO_PASSWORD } from "./infrastructure.js";
import type { TestApp } from "./test-app.js";

export { TEST_DEMO_PASSWORD };

export const API = "/api/v1";

/** The cookies one sign-in handed out, as a browser would hold them. */
export interface Browser {
  readonly session: Session;
  readonly jar: Record<string, string>;
  /** The Cookie header for a request to `path`: the refresh cookie goes only to /api/v1/auth. */
  cookieHeader(path?: string): string;
  /** The CSRF header a page would send. */
  readonly csrf: string;
}

export function parseSetCookie(
  header: string | string[] | undefined,
): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const line of [header ?? []].flat()) {
    const [pair = ""] = line.split(";");
    const index = pair.indexOf("=");
    if (index > 0) jar[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return jar;
}

export function browserFrom(
  session: Session,
  setCookie: string | string[] | undefined,
  previous: Record<string, string> = {},
): Browser {
  return makeBrowser(session, { ...previous, ...parseSetCookie(setCookie) });
}

/** The same browser with some cookies replaced, or removed when the value is null. */
export function withCookies(
  browser: Browser,
  changes: Record<string, string | null>,
): Browser {
  const jar = { ...browser.jar };
  for (const [name, value] of Object.entries(changes)) {
    if (value === null) Reflect.deleteProperty(jar, name);
    else jar[name] = value;
  }
  return makeBrowser(browser.session, jar);
}

function makeBrowser(session: Session, jar: Record<string, string>): Browser {
  return {
    session,
    jar,
    csrf: jar[COOKIES.csrf] ?? "",
    cookieHeader(path = `${API}/x`) {
      return Object.entries(jar)
        .filter(
          ([name]) =>
            name !== COOKIES.refresh || path.startsWith(`${API}/auth`),
        )
        .map(([name, value]) => `${name}=${value}`)
        .join("; ");
    },
  };
}

export async function demoSignIn(t: TestApp, role: Role): Promise<Browser> {
  const res = await request(t.app.getHttpServer())
    .post(`${API}/auth/demo-login`)
    .send({ role });
  if (res.status !== 200) {
    throw new Error(`demo sign-in failed: ${String(res.status)} ${res.text}`);
  }
  return browserFrom(
    (res.body as { data: Session }).data,
    res.headers["set-cookie"],
  );
}

export async function emailForRole(role: Role): Promise<string> {
  const { demoEmail } = await import("../../src/auth/demo-accounts.js");
  return demoEmail(role);
}

/** A call as the browser would make it: cookies, plus the CSRF header on request. */
export function call(
  t: TestApp,
  browser: Browser | null,
  method: "get" | "post",
  path: string,
  options: { csrf?: boolean | string; body?: object } = {},
): request.Test {
  const req = request(t.app.getHttpServer())[method](path);
  if (browser) {
    const header = browser.cookieHeader(path);
    if (header) req.set("Cookie", header);
    if (options.csrf === true) req.set(HEADERS.csrf, browser.csrf);
    else if (typeof options.csrf === "string") {
      req.set(HEADERS.csrf, options.csrf);
    }
  }
  return options.body ? req.send(options.body) : req;
}

/** Every audit event written so far, oldest first. */
export async function auditEvents(t: TestApp) {
  const events = [];
  for await (const event of t.app.get(AuditEventRepository).readChain()) {
    events.push(event);
  }
  return events;
}

export async function auditCount(t: TestApp, action?: string): Promise<number> {
  const events = await auditEvents(t);
  return action
    ? events.filter((e) => e.action === action).length
    : events.length;
}
