import { twoStepRoutes } from "@orderpilot/shared";
import { describe, expect, it, vi } from "vitest";
import { errorBody } from "@/test/fixtures";
import { ApiClient } from "./client";
import { ApiError } from "./errors";

function reply(status: number, body: unknown, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function setup(responses: (() => Response)[]) {
  const queue = [...responses];
  const fetchMock = vi.fn(() => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra request");
    return Promise.resolve(next());
  });
  const client = new ApiClient({
    fetch: fetchMock as unknown as typeof fetch,
    // A page that was reloaded under a session: the CSRF cookie is readable.
    readCookie: (name) => (name === "op_csrf" ? "tok" : undefined),
    newRequestId: () => "req-1",
  });
  return { client, fetchMock };
}

describe("the second step on the client", () => {
  it("does not refresh after a wrong code or an ended challenge", async () => {
    const { client, fetchMock } = setup([
      () => reply(401, errorBody("TWO_STEP_CHALLENGE_ENDED")),
    ]);
    await expect(
      client.call(twoStepRoutes.verify, { code: "123456" }),
    ).rejects.toMatchObject({ code: "TWO_STEP_CHALLENGE_ENDED" });
    // One request only: a refresh and a resend would make it three.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("puts the Retry-After header of a 429 on the ApiError", async () => {
    const { client } = setup([
      () => reply(429, errorBody("TWO_STEP_LOCKED"), { "Retry-After": "900" }),
    ]);
    const error = await client
      .call(twoStepRoutes.verify, { code: "123456" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).retryAfterSeconds).toBe(900);
  });

  it("leaves the wait empty when the header is missing or is not whole seconds", async () => {
    const { client } = setup([
      () => reply(429, errorBody("TWO_STEP_LOCKED")),
      () =>
        reply(429, errorBody("TWO_STEP_LOCKED"), {
          "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT",
        }),
    ]);
    for (let i = 0; i < 2; i += 1) {
      const error = await client
        .call(twoStepRoutes.verify, { code: "123456" })
        .catch((e: unknown) => e);
      expect((error as ApiError).retryAfterSeconds).toBeNull();
    }
  });
});
