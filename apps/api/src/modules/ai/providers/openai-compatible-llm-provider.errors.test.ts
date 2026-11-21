import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeChatServer } from "../../../../test/support/fake-chat-server.js";
import { baseEnv } from "../../../../test/support/base-env.js";
import { AppConfig } from "../../../config/app-config.js";
import { AiProviderError } from "../domain/ai-errors.js";
import type { AiStepRequest } from "../domain/llm-provider.js";
import { retryAfterMsOf } from "./ai-sdk-translator.js";
import { OpenAiCompatibleLlmProvider } from "./openai-compatible-llm-provider.js";

// What a provider's failure may and may not look like to the code above it.
// The fake server puts a marker in every error body, and the settings carry a
// marker key: a failure must never carry either of them out.

const KEY = "sk-leak-marker-7c41";
const BODY_MARKER = "BODY-MARKER-prompt-and-secrets-4d9e";
const SIGNAL = new AbortController().signal;

let server: FakeChatServer;

beforeEach(async () => {
  server = await FakeChatServer.start();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await server.close();
});

function provider(): OpenAiCompatibleLlmProvider {
  return new OpenAiCompatibleLlmProvider(
    AppConfig.fromEnv(
      baseEnv({
        AI_PROVIDER: "openai-compatible",
        AI_BASE_URL: server.baseUrl,
        AI_API_KEY: KEY,
        AI_MODEL: "text-model",
      }),
    ).ai,
  );
}

const request: AiStepRequest = {
  feature: "unit",
  promptVersion: "v1",
  instructions: "Read.",
  messages: [{ role: "user", parts: [{ type: "text", text: "Hello." }] }],
  tools: [],
  maxOutputTokens: 64,
};

async function failureOf(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("It was expected to fail.");
}

async function drain(parts: AsyncIterable<unknown>): Promise<void> {
  const seen: unknown[] = [];
  for await (const part of parts) seen.push(part);
}

/** Every place a secret could hide in a thrown value, as one searchable text. */
function everythingIn(error: unknown): string {
  const seen = new Set<unknown>();
  const texts: string[] = [];
  const visit = (value: unknown): void => {
    if (typeof value !== "object" || value === null || seen.has(value)) return;
    seen.add(value);
    for (const name of Object.getOwnPropertyNames(value)) {
      const inner = (value as Record<string, unknown>)[name];
      if (typeof inner === "string") texts.push(inner);
      visit(inner);
    }
    if (value instanceof Error) {
      texts.push(value.message, value.stack ?? "");
      visit(value.cause);
    }
  };
  visit(error);
  texts.push(String(error));
  try {
    texts.push(JSON.stringify(error));
  } catch {
    // A circular error would be a leak of its own kind, and visit() has read it.
  }
  return texts.join("\n");
}

function expectNoLeak(error: unknown): void {
  const text = everythingIn(error);
  expect(text).not.toContain(KEY);
  expect(text).not.toContain(BODY_MARKER);
  expect(text).not.toContain(server.baseUrl);
  expect(text).not.toContain("127.0.0.1");
}

describe("a failure of the OpenAI-compatible provider", () => {
  it("is a 429 with the wait the server asked for, in seconds", async () => {
    server.reply({
      kind: "status",
      status: 429,
      headers: { "retry-after": "7" },
      body: JSON.stringify({ error: { message: BODY_MARKER } }),
    });

    const error = await failureOf(() => provider().step(request, SIGNAL));

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({
      reasonCode: "provider-http-429",
      outcome: "error",
      retryAfterMs: 7000,
    });
    expectNoLeak(error);
  });

  it("is a 429 whose wait is an HTTP date", async () => {
    const at = new Date(Date.now() + 20_000).toUTCString();
    server.reply({
      kind: "status",
      status: 429,
      headers: { "retry-after": at },
      body: BODY_MARKER,
    });

    const error = await failureOf(() => provider().step(request, SIGNAL));

    expect(error).toBeInstanceOf(AiProviderError);
    const wait = (error as AiProviderError).retryAfterMs ?? 0;
    expect(wait).toBeGreaterThan(17_000);
    expect(wait).toBeLessThanOrEqual(20_000);
  });

  it("is a 500, with no wait hint", async () => {
    server.reply({
      kind: "status",
      status: 500,
      body: JSON.stringify({ error: { message: BODY_MARKER } }),
    });

    const error = await failureOf(() => provider().step(request, SIGNAL));

    expect(error).toMatchObject({
      reasonCode: "provider-http-500",
      retryAfterMs: null,
    });
    expectNoLeak(error);
  });

  it("is a 401 that does not echo the key it was sent", async () => {
    server.reply({
      kind: "status",
      status: 401,
      body: JSON.stringify({
        error: { message: `Incorrect API key: ${KEY} ${BODY_MARKER}` },
      }),
    });

    const error = await failureOf(() => provider().step(request, SIGNAL));

    expect(error).toMatchObject({ reasonCode: "provider-http-401" });
    expectNoLeak(error);
  });

  it("is provider-bad-response for a 200 whose body is not JSON", async () => {
    server.reply({ kind: "raw", body: `<html>${BODY_MARKER}</html>` });

    const error = await failureOf(() => provider().step(request, SIGNAL));

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ reasonCode: "provider-bad-response" });
    expectNoLeak(error);
  });

  it("is provider-bad-response for JSON that is not a chat completion", async () => {
    server.reply({
      kind: "raw",
      body: JSON.stringify({ answer: BODY_MARKER, choices: "none" }),
    });

    const error = await failureOf(() => provider().step(request, SIGNAL));

    expect(error).toMatchObject({ reasonCode: "provider-bad-response" });
    expectNoLeak(error);
  });

  it("is provider-network when nothing answers", async () => {
    const lone = provider();
    await server.close();

    const error = await failureOf(() => lone.step(request, SIGNAL));

    expect(error).toBeInstanceOf(AiProviderError);
    expect(error).toMatchObject({ reasonCode: "provider-network" });
    expectNoLeak(error);
    // afterEach closes a server again.
    server = await FakeChatServer.start();
  });

  it("passes an abort on untouched, for the caller to explain", async () => {
    server.reply({ kind: "hang" });
    const controller = new AbortController();
    const pending = failureOf(() =>
      provider().step(request, controller.signal),
    );
    await vi.waitFor(() => {
      expect(server.requests).toHaveLength(1);
    });

    controller.abort();
    const error = await pending;

    expect(error).not.toBeInstanceOf(AiProviderError);
    expect(error).toBeInstanceOf(Error);
  });

  it("is the same on a stream: a 429 before the first part", async () => {
    server.reply({
      kind: "status",
      status: 429,
      headers: { "retry-after": "3" },
      body: BODY_MARKER,
    });

    const error = await failureOf(() =>
      drain(provider().stream(request, SIGNAL)),
    );

    expect(error).toMatchObject({
      reasonCode: "provider-http-429",
      retryAfterMs: 3000,
    });
    expectNoLeak(error);
  });

  it("is provider-bad-response on a stream that sends something that is not an event", async () => {
    server.reply({
      kind: "raw",
      body: `data: {${BODY_MARKER}\n\ndata: [DONE]\n\n`,
    });

    const error = await failureOf(() =>
      drain(provider().stream(request, SIGNAL)),
    );

    expect(error).toMatchObject({ reasonCode: "provider-bad-response" });
    expectNoLeak(error);
  });

  it("writes nothing to the console, whatever the server said", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map(
      (method) => vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    server.reply(
      { kind: "status", status: 500, body: BODY_MARKER },
      { kind: "raw", body: BODY_MARKER },
      { kind: "status", status: 429, body: BODY_MARKER },
    );

    await failureOf(() => provider().step(request, SIGNAL));
    await failureOf(() => provider().step(request, SIGNAL));
    await failureOf(() => drain(provider().stream(request, SIGNAL)));

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("a retry-after header", () => {
  const now = Date.parse("2026-11-15T10:00:00Z");

  it.each([
    ["5", 5000],
    ["0", 0],
    ["1.5", 1500],
    [" 12 ", 12_000],
    ["Sun, 15 Nov 2026 10:00:30 GMT", 30_000],
    ["Sun, 15 Nov 2026 09:59:00 GMT", 0],
  ])("%j is read as %j ms", (value, expected) => {
    expect(retryAfterMsOf(value, now)).toBe(expected);
  });

  it.each([undefined, "", "soon", "-5"])("%j is no hint", (value) => {
    expect(retryAfterMsOf(value, now)).toBeNull();
  });
});
