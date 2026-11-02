import { readFileSync } from "node:fs";
import path from "node:path";
import { API_BASE_PATH, apiPath } from "@orderpilot/shared";
// The stack smoke test's reading of STACK_WEB_PORT: the shell wins, then the
// root .env, then 8080. Reused so the two can never disagree on the port.
import { webPort } from "../../../scripts/stack-smoke.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");

function readRootEnv(): string {
  return readFileSync(path.join(repositoryRoot, ".env"), "utf8");
}

/**
 * Where the web app is: E2E_BASE_URL, or the compose stack on this machine.
 * Trailing slashes are dropped so paths join cleanly.
 */
export const BASE_URL = (
  process.env.E2E_BASE_URL ??
  `http://localhost:${webPort(process.env, readRootEnv)}`
).replace(/\/+$/, "");

/** The origin a browser on BASE_URL sends, which the API's origin check expects. */
export const ORIGIN = new URL(BASE_URL).origin;

/**
 * A full URL on the API. The compose stack reaches the API only through the
 * web container's proxy, so this is BASE_URL unless E2E_API_URL names the API
 * itself (for example a `pnpm dev` API on its own port). Either way the call is
 * a plain HTTP request: no page and no web code is involved.
 *
 * Takes a route path such as "/audit/events", or a full "/api/v1/..." path.
 */
export function apiUrl(route: string): string {
  const base = (process.env.E2E_API_URL ?? BASE_URL).replace(/\/+$/, "");
  const full = route.startsWith(`${API_BASE_PATH}/`) ? route : apiPath(route);
  return `${base}${full}`;
}

/** The folder that holds each role's stored session for this run. */
export const SESSION_DIR = path.resolve(import.meta.dirname, "../.auth");
