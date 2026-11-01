import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { checkStack } from "./stack-smoke.mjs";

const APP_POLICY = "default-src 'self'; script-src 'self'";
const API_POLICY = "default-src 'none'; frame-ancestors 'none'";
const INDEX = `<div id="root"></div><script src="/assets/index-abc.js"></script>`;

/** A stack that does everything right, with `broken` swapped in per path. */
function stack(broken = {}) {
  const staticHeaders = {
    "content-security-policy": APP_POLICY,
    "x-content-type-options": "nosniff",
    "cache-control": "no-cache",
  };
  const routes = {
    "/healthz": () => new Response("ok"),
    "/": () => new Response(INDEX, { headers: staticHeaders }),
    "/tracker/orders/does-not-matter": () => new Response(INDEX),
    "/assets/index-abc.js": () =>
      new Response("js", {
        headers: {
          ...staticHeaders,
          "cache-control": "public, max-age=31536000, immutable",
        },
      }),
    "/assets/not-a-file.js": () => new Response("", { status: 404 }),
    "/api/v1/auth/me": (init) =>
      init?.headers?.cookie
        ? new Response(JSON.stringify({ data: { role: "SUPPORT" } }))
        : new Response(
            JSON.stringify({ error: { traceId: "stack-smoke-1" } }),
            {
              status: 401,
              headers: {
                "content-security-policy": API_POLICY,
                "x-request-id": "stack-smoke-1",
              },
            },
          ),
    "/api/docs": () => new Response("swagger"),
    "/api/v1/auth/demo-login": () =>
      new Response("{}", { headers: { "set-cookie": "a=1; HttpOnly" } }),
    ...broken,
  };
  return (url, init) => {
    const route = routes[new URL(url).pathname];
    assert.ok(route, url);
    return Promise.resolve(route(init));
  };
}

async function problems(broken) {
  const results = await checkStack("http://stack.test", stack(broken));
  return results.filter(({ problem }) => problem !== null);
}

describe("stack smoke", () => {
  it("passes a stack that does everything right", async () => {
    assert.deepEqual(await problems(), []);
  });

  it("fails when nginx adds its policy to a proxied API answer", async () => {
    const failed = await problems({
      "/api/v1/auth/me": () =>
        new Response(JSON.stringify({ error: {} }), {
          status: 401,
          headers: {
            "content-security-policy": `${APP_POLICY}, ${API_POLICY}`,
          },
        }),
    });
    assert.match(failed[0].name, /only the API's own policy/);
  });

  it("fails when a deep link is a 404 instead of the app", async () => {
    const failed = await problems({
      "/tracker/orders/does-not-matter": () =>
        new Response("", { status: 404 }),
    });
    assert.match(failed[0].name, /deep link/);
  });

  it("fails when a location loses the security headers", async () => {
    const failed = await problems({
      "/assets/index-abc.js": () =>
        new Response("js", {
          headers: { "cache-control": "max-age=31536000, immutable" },
        }),
    });
    assert.match(failed[0].name, /hashed file/);
  });

  it("fails when a missing script comes back as the app", async () => {
    const failed = await problems({
      "/assets/not-a-file.js": () => new Response(INDEX),
    });
    assert.match(failed[0].name, /missing hashed file/);
  });

  it("reports a stack that cannot be reached, for every check", async () => {
    const results = await checkStack("http://stack.test", () =>
      Promise.reject(new Error("connection refused")),
    );
    assert.equal(results.filter(({ problem }) => problem).length, 8);
  });
});
