// Proves a running compose stack from the outside, as a browser would use it:
//
//   node scripts/stack-smoke.mjs [baseUrl]
//
// The base URL defaults to http://localhost:STACK_WEB_PORT (8080). Health checks
// say each container is up; this says the pieces work together: nginx serves the
// app, proxies the API without adding to its headers, and a person can sign in.
// Plain Node with no dependencies, so CI can run it without an install.

import { pathToFileURL } from "node:url";

const ROLE = "SUPPORT";

/**
 * The checks, in order. Each returns null or says what is wrong.
 *
 * @param {string} base
 * @param {typeof fetch} get
 * @returns {Promise<{ name: string, problem: string | null }[]>}
 */
export async function checkStack(base, get = fetch) {
  const results = [];
  const check = async (name, run) => {
    let problem;
    try {
      problem = await run();
    } catch (error) {
      problem = error instanceof Error ? error.message : String(error);
    }
    results.push({ name, problem });
  };
  const url = (path) => new URL(path, base).href;
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
  await check("a missing hashed file is a 404, not the app", async () => {
    const res = await get(url("/assets/not-a-file.js"));
    return res.status === 404 ? null : `status ${String(res.status)}`;
  });
  await check(
    "a proxied API answer carries only the API's own policy",
    async () => {
      const res = await get(url("/api/v1/auth/me"), {
        headers: { "X-Request-Id": "stack-smoke-1" },
      });
      const body = await res.json();
      const policy = res.headers.get("content-security-policy") ?? "";
      if (res.status !== 401) return `status ${String(res.status)}`;
      if (!policy.startsWith("default-src 'none'")) return `CSP is "${policy}"`;
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
      headers: { "Content-Type": "application/json" },
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
  const port = process.env["STACK_WEB_PORT"] ?? "8080";
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
