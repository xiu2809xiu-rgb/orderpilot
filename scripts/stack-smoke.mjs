// Proves a running compose stack from the outside, as a browser would use it:
//
//   node scripts/stack-smoke.mjs [baseUrl]
//
// The base URL defaults to http://localhost:STACK_WEB_PORT (8080). Health checks
// say each container is up; this says the pieces work together: nginx serves the
// app, proxies the API without adding to its headers, and a person can sign in.
// Plain Node with no dependencies, so CI can run it without an install.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROLE = "SUPPORT";

/**
 * What the API sends on every JSON answer (apps/api/src/bootstrap/security.ts).
 * Helmet joins directives with a bare semicolon, so that is what is compared.
 * Compared whole: nginx puts the upstream header first and its own after it, so
 * a prefix check would pass a second, combined policy.
 */
const API_POLICY =
  "default-src 'none';frame-ancestors 'none';base-uri 'none';form-action 'none'";

/**
 * The port compose publishes the web app on: the shell wins, then the root
 * .env (the way compose reads it), then 8080. Only this one variable is taken
 * from the file, so nothing else in it is ever held or printed.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {() => string} readRootEnv
 */
export function webPort(env, readRootEnv) {
  const fromShell = env["STACK_WEB_PORT"];
  if (fromShell !== undefined && fromShell !== "") return fromShell;
  let text = "";
  try {
    text = readRootEnv();
  } catch {
    // No .env is fine: the default port is then the right one.
  }
  const line = /^\s*STACK_WEB_PORT\s*=\s*(.*?)\s*$/m.exec(text)?.[1] ?? "";
  // Compose ends an unquoted value at " #", and a quoted one at its closing quote.
  const quoted = /^(["'])(.*?)\1/.exec(line)?.[2];
  const value = (quoted ?? line.replace(/\s+#.*$/, "")).trim();
  return /^\d{1,5}$/.test(value) ? value : "8080";
}

/**
 * @typedef {(url: string, init?: RequestInit) => Promise<Response>} Get
 * @typedef {{ name: string, problem: string | null }} Result
 */

/**
 * The checks, in order. Each returns null or says what is wrong.
 *
 * @param {string} base
 * @param {Get} get
 * @returns {Promise<Result[]>}
 */
export async function checkStack(base, get = fetch) {
  /** @type {Result[]} */
  const results = [];
  /**
   * @param {string} name
   * @param {() => Promise<string | null>} run
   */
  const check = async (name, run) => {
    let problem;
    try {
      problem = await run();
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    results.push({ name, problem });
  };
  /** @param {string} path */
  const url = (path) => new URL(path, base).href;
  /** @param {Response} res */
  const headerProblem = (res) => {
    const policy = res.headers.get("content-security-policy") ?? "";
    if (!policy.includes("script-src 'self'")) return `CSP is "${policy}"`;
    return res.headers.get("x-content-type-options") === "nosniff"
      ? null
      : "X-Content-Type-Options is missing";
  };

  let html = "";
  await check("nginx answers its health check", async () => {
    const res = await get(url("/healthz"));
    return res.status === 200 ? null : `status ${String(res.status)}`;
  });
  await check(
    "the app has the security headers and is not cached",
    async () => {
      const res = await get(url("/"));
      html = await res.text();
      if (res.status !== 200) return `status ${String(res.status)}`;
      if (!html.includes('id="root"'))
        return "this is not the app's index.html";
      if (res.headers.get("cache-control") !== "no-cache") {
        return `Cache-Control is "${res.headers.get("cache-control")}"`;
      }
      return headerProblem(res);
    },
  );
  await check("a deep link falls back to the app", async () => {
    const res = await get(url("/tracker/orders/does-not-matter"));
    const body = await res.text();
    if (res.status !== 200) return `status ${String(res.status)}`;
    return body === html ? null : "the deep link did not return index.html";
  });
  await check(
    "a hashed file is cached for a year and keeps its headers",
    async () => {
      const asset = /(?:src|href)="(\/assets\/[^"]+\.js)"/.exec(html)?.[1];
      if (asset === undefined) return "index.html names no hashed script";
      const res = await get(url(asset));
      const cache = res.headers.get("cache-control") ?? "";
      if (res.status !== 200) return `status ${String(res.status)}`;
      if (!cache.includes("immutable")) return `Cache-Control is "${cache}"`;
      return headerProblem(res);
    },
  );
  await check(
    "a missing hashed file is a 404, not the app, and is never cached",
    async () => {
      const res = await get(url("/assets/not-a-file.js"));
      if (res.status !== 404) return `status ${String(res.status)}`;
      // A year-long cache on a 404 would keep a client failing after a rollback.
      const cache = res.headers.get("cache-control") ?? "";
      return /immutable|max-age=[1-9]/.test(cache)
        ? `the 404 is cached: Cache-Control is "${cache}"`
        : null;
    },
  );
  await check(
    "a proxied API answer carries only the API's own policy",
    async () => {
      const res = await get(url("/api/v1/auth/me"), {
        headers: { "X-Request-Id": "stack-smoke-1" },
      });
      // The envelope is checked, not trusted: any other shape fails below.
      const body = /** @type {{ error?: { traceId?: unknown } } | null} */ (
        await res.json()
      );
      const policy = res.headers.get("content-security-policy") ?? "";
      const sniff = res.headers.get("x-content-type-options");
      if (res.status !== 401) return `status ${String(res.status)}`;
      if (policy !== API_POLICY) return `CSP is "${policy}"`;
      // A header sent twice is read back as "a, b".
      if (sniff !== "nosniff") return `X-Content-Type-Options is "${sniff}"`;
      if (res.headers.has("permissions-policy")) {
        return "nginx added a Permissions-Policy to an API answer";
      }
      if (res.headers.get("x-request-id") !== "stack-smoke-1") {
        return "the request id did not reach the API";
      }
      return body?.error?.traceId === "stack-smoke-1"
        ? null
        : "the error envelope has another trace id";
    },
  );
  await check("Swagger opens through the proxy", async () => {
    const res = await get(url("/api/docs"));
    return res.status === 200 ? null : `status ${String(res.status)}`;
  });
  await check(`${ROLE} can sign in and the session works`, async () => {
    const login = await get(url("/api/v1/auth/demo-login"), {
      method: "POST",
      // As a browser sends it, so the API's origin check is part of the test.
      headers: {
        "Content-Type": "application/json",
        Origin: new URL(base).origin,
      },
      body: JSON.stringify({ role: ROLE }),
    });
    if (login.status !== 200) return `sign-in status ${String(login.status)}`;
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const me = await get(url("/api/v1/auth/me"), { headers: { cookie } });
    if (me.status !== 200) return `/auth/me status ${String(me.status)}`;
    const text = await me.text();
    return text.includes(ROLE) ? null : "the session does not carry the role";
  });
  return results;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const port = webPort(process.env, () =>
    readFileSync(resolve(root, ".env"), "utf8"),
  );
  const base = process.argv[2] ?? `http://localhost:${port}`;
  const results = await checkStack(base);
  for (const { name, problem } of results) {
    console.log(`${problem === null ? "ok  " : "FAIL"} ${name}`);
    if (problem !== null) console.log(`     ${problem}`);
  }
  const failed = results.filter(({ problem }) => problem !== null).length;
  console.log(
    `${String(results.length - failed)} of ${String(results.length)} passed at ${base}`,
  );
  return failed === 0 ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main();
}
