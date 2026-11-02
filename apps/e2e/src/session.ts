import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  request,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { authRoutes, COOKIES, type Role } from "@orderpilot/shared";
import { apiUrl, BASE_URL, ORIGIN, SESSION_DIR } from "./env.js";

/** What Playwright stores for a signed-in browser: its cookies. */
export type StoredSession = Awaited<ReturnType<BrowserContext["storageState"]>>;

/**
 * A stored session is reused for ten minutes. The access token lasts fifteen
 * (ACCESS_TOKEN_TTL_SECONDS), so no test ever sends an expired one. That
 * matters: an expired token makes the web app refresh, and two tests
 * refreshing the same stored refresh token at once is a reuse, which ends
 * the whole sign-in by design (ADR 0012).
 */
const REUSE_FOR_MS = 10 * 60 * 1000;

export function sessionFile(role: Role): string {
  return path.join(SESSION_DIR, `${role.toLowerCase()}.json`);
}

/**
 * Signs in through the demo route, the one the sign-in page's role buttons
 * use. The cookies land in whatever context `api` belongs to.
 */
export async function demoSignIn(
  api: APIRequestContext,
  role: Role,
): Promise<void> {
  const res = await api.post(apiUrl(authRoutes.demoLogin.path), {
    data: { role },
    // As a browser sends it: the API refuses a sign-in from another origin.
    headers: { Origin: ORIGIN },
  });
  if (res.status() !== 200) {
    throw new Error(
      `The demo sign-in as ${role} answered ${String(res.status())}: ${(await res.text()).slice(0, 300)}`,
    );
  }
}

/** Signs in as `role` and stores the session for the rest of the run. */
export async function storeSession(role: Role): Promise<StoredSession> {
  const api = await request.newContext({ baseURL: BASE_URL });
  try {
    await demoSignIn(api, role);
    const state = await api.storageState();
    await mkdir(SESSION_DIR, { recursive: true });
    // Written then renamed, so a parallel reader never sees half a file.
    const file = sessionFile(role);
    const partial = `${file}.${String(process.pid)}.tmp`;
    await writeFile(partial, JSON.stringify(state));
    await rename(partial, file);
    return state;
  } finally {
    await api.dispose();
  }
}

/** The stored session for `role`, signing in again once it is too old to trust. */
export async function sessionFor(role: Role): Promise<StoredSession> {
  const file = sessionFile(role);
  try {
    const { mtimeMs } = await stat(file);
    if (Date.now() - mtimeMs < REUSE_FOR_MS) {
      return JSON.parse(await readFile(file, "utf8")) as StoredSession;
    }
  } catch {
    // Not stored yet: sign in below.
  }
  return storeSession(role);
}

/** The CSRF token of a stored session, for the X-CSRF-Token header. */
export function csrfToken(session: StoredSession): string {
  const cookie = session.cookies.find(({ name }) => name === COOKIES.csrf);
  if (!cookie) throw new Error("The stored session has no CSRF cookie.");
  return cookie.value;
}

export interface SignInOptions {
  /**
   * A new sign-in of its own instead of the stored one. Use it in a test that
   * signs out, so the other tests keep their session.
   */
  readonly fresh?: boolean;
}

/**
 * Gives the page a real session as one of the nine demo personas. Call it
 * before the first `page.goto`. It costs no sign-in unless `fresh` is set or
 * the stored session is more than ten minutes old.
 */
export async function signInAs(
  page: Page,
  role: Role,
  { fresh = false }: SignInOptions = {},
): Promise<void> {
  if (fresh) {
    // page.request shares the page's cookie jar, so the browser is signed in.
    await demoSignIn(page.request, role);
    return;
  }
  const { cookies } = await sessionFor(role);
  await page.context().addCookies(cookies);
}
