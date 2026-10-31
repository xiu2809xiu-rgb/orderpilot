import { authRoutes, HEADERS } from "@orderpilot/shared";
import { describe, expect, it, vi } from "vitest";
import { errorBody, sessionFor } from "@/test/fixtures";
import { ApiClient } from "./client";
import { ApiError, ContractError, NetworkError, traceIdOf } from "./errors";

function reply(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function setup(
  responses: (() => Response | Promise<Response>)[],
  cookies: Record<string, string> = {},
) {
  const queue = [...responses];
  const fetchMock = vi.fn(() => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra request");
    return Promise.resolve(next());
  });
  const onSessionEnded = vi.fn();
  const onSessionRefreshed = vi.fn();
  const client = new ApiClient({
    fetch: fetchMock as unknown as typeof fetch,
    readCookie: (name) => cookies[name],
    newRequestId: () => "req-1",
    onSessionEnded,
    onSessionRefreshed,
  });
  return { client, fetchMock, onSessionEnded, onSessionRefreshed };
}

function sentHeaders(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  return calls[call]?.[1].headers as Record<string, string>;
}

const session = sessionFor("SUPPORT");

describe("ApiClient requests", () => {
  it("sends the request id and no CSRF header on a GET", async () => {
    const { client, fetchMock } = setup([() => reply(200, { data: session })], {
      op_csrf: "tok",
    });
    await client.call(authRoutes.me);
    const headers = sentHeaders(fetchMock);
    expect(headers[HEADERS.requestId]).toBe("req-1");
    expect(headers[HEADERS.csrf]).toBeUndefined();
  });

  it("copies the readable CSRF cookie into the header on a POST", async () => {
    const { client, fetchMock } = setup(
      [() => reply(200, { data: { ok: true } })],
      { op_csrf: "tok-123" },
    );
    await client.call(authRoutes.logout);
    expect(sentHeaders(fetchMock)[HEADERS.csrf]).toBe("tok-123");
  });

  it("validates the request body against the shared schema", async () => {
    const { client, fetchMock } = setup([]);
    await expect(
      // @ts-expect-error the role is not one of the nine
      client.call(authRoutes.demoLogin, { role: "CEO" }),
    ).rejects.toBeInstanceOf(ContractError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("ApiClient answers", () => {
  it("returns an answer that matches the contract", async () => {
    const { client } = setup([() => reply(200, { data: session })]);
    const result = await client.call(authRoutes.me);
    expect(result.data.user.role).toBe("SUPPORT");
  });

  it("throws a ContractError, with the trace id, for a wrong shape", async () => {
    const { client } = setup([
      () => reply(200, { data: { user: 1 } }, { [HEADERS.requestId]: "srv-9" }),
    ]);
    const error = await client.call(authRoutes.me).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContractError);
    expect(traceIdOf(error)).toBe("srv-9");
  });

  it("turns the error envelope into an ApiError carrying the trace id", async () => {
    const { client } = setup([
      () => reply(401, errorBody("INVALID_CREDENTIALS", "trace-77")),
    ]);
    const error = await client
      .call(authRoutes.login, { email: "a@example.test", password: "x" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: "INVALID_CREDENTIALS",
      status: 401,
      traceId: "trace-77",
    });
  });

  it("still gives a typed error when the body is not the envelope", async () => {
    const { client } = setup([
      () => new Response("<html>bad gateway</html>", { status: 503 }),
    ]);
    const error = await client
      .call(authRoutes.options)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      status: 503,
      traceId: "req-1",
    });
  });

  it("throws a NetworkError, with the request id, when nothing answers", async () => {
    const client = new ApiClient({
      fetch: () => Promise.reject(new TypeError("offline")),
      readCookie: () => undefined,
      newRequestId: () => "req-off",
    });
    const error = await client
      .call(authRoutes.options)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(traceIdOf(error)).toBe("req-off");
  });
});

describe("ApiClient refresh", () => {
  it("refreshes once and retries when a session was started", async () => {
    const { client, fetchMock, onSessionRefreshed } = setup(
      [
        () => reply(401, errorBody("SESSION_EXPIRED")),
        () => reply(200, { data: session }),
        () => reply(200, { data: session }),
      ],
      { op_csrf: "tok" },
    );
    client.markSessionStarted();
    const result = await client.call(authRoutes.me);
    expect(result.data.user.id).toBe(session.user.id);
    const paths = (fetchMock.mock.calls as unknown as [string][]).map(
      ([url]) => url,
    );
    expect(paths).toEqual([
      "/api/v1/auth/me",
      "/api/v1/auth/refresh",
      "/api/v1/auth/me",
    ]);
    expect(onSessionRefreshed).toHaveBeenCalledWith(session);
  });

  it("shares one refresh between calls that fail at the same time", async () => {
    const { client, fetchMock } = setup(
      [
        () => reply(401, errorBody("SESSION_EXPIRED")),
        () => reply(401, errorBody("SESSION_EXPIRED")),
        () => reply(200, { data: session }),
        () => reply(200, { data: session }),
        () => reply(200, { data: session }),
      ],
      { op_csrf: "tok" },
    );
    client.markSessionStarted();
    await Promise.all([client.call(authRoutes.me), client.call(authRoutes.me)]);
    const refreshes = (fetchMock.mock.calls as unknown as [string][]).filter(
      ([url]) => url.endsWith("/auth/refresh"),
    );
    expect(refreshes).toHaveLength(1);
  });

  it("never tries to refresh when no session was ever started", async () => {
    const { client, fetchMock, onSessionEnded } = setup([
      () => reply(401, errorBody("UNAUTHENTICATED")),
    ]);
    await expect(client.call(authRoutes.me)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onSessionEnded).not.toHaveBeenCalled();
  });

  it("does not refresh after a failed sign-in", async () => {
    const { client, fetchMock } = setup(
      [() => reply(401, errorBody("INVALID_CREDENTIALS"))],
      { op_csrf: "tok" },
    );
    client.markSessionStarted();
    await expect(
      client.call(authRoutes.login, { email: "a@example.test", password: "x" }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ends the session when the refresh fails, and stops trying", async () => {
    const { client, fetchMock, onSessionEnded } = setup(
      [
        () => reply(401, errorBody("SESSION_EXPIRED")),
        () => reply(401, errorBody("REFRESH_REUSED")),
        () => reply(401, errorBody("UNAUTHENTICATED")),
      ],
      { op_csrf: "tok" },
    );
    client.markSessionStarted();
    const first = await client.call(authRoutes.me).catch((e: unknown) => e);
    expect(first).toMatchObject({ code: "SESSION_EXPIRED" });
    expect(onSessionEnded).toHaveBeenCalledTimes(1);
    // The CSRF cookie may linger, but a ended session is not refreshed again.
    await client.call(authRoutes.me).catch(() => undefined);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("treats the CSRF cookie as proof of an earlier session after a reload", async () => {
    const { client, fetchMock } = setup(
      [
        () => reply(401, errorBody("SESSION_EXPIRED")),
        () => reply(200, { data: session }),
        () => reply(200, { data: session }),
      ],
      { op_csrf: "tok" },
    );
    await client.call(authRoutes.me);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
