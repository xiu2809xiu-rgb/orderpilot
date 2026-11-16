import { afterEach, describe, expect, it, vi } from "vitest";
import { baseEnv } from "../../../../test/support/base-env.js";
import { AppConfig } from "../../../config/app-config.js";
import { AiProviderError } from "../domain/ai-errors.js";
import type { AiStepRequest, JsonSchema } from "../domain/llm-provider.js";
import {
  BedrockLlmProvider,
  bedrockBaseUrlOf,
} from "./bedrock-llm-provider.js";

// NOT VERIFIED AGAINST AWS. Nothing here reaches Bedrock: the SDK is given a
// fetch that records the request it would have signed and sent. That shows the
// endpoint, the signing headers, the body's shape and that the process
// environment is not read. It does not show that Bedrock accepts the request,
// that a model id exists, or how Bedrock answers beyond the one reply below.

const loads = vi.hoisted(() => ({ count: 0 }));
vi.mock("@ai-sdk/amazon-bedrock", async (importOriginal) => {
  // A mock factory runs when the module is first imported, so this counts imports.
  loads.count += 1;
  return await importOriginal();
});

const ACCESS_KEY_ID = "AKIATESTMARKER0000";
const SECRET = "secret-marker-5b1d";
const SESSION = "session-marker-77aa";
const SIGNAL = new AbortController().signal;

const SCHEMA: JsonSchema = {
  type: "object",
  properties: { total: { type: "number" } },
  required: ["total"],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

function settingsOf(extra: NodeJS.ProcessEnv = {}): AppConfig["ai"] {
  return AppConfig.fromEnv(
    baseEnv({
      AI_PROVIDER: "bedrock",
      AI_MODEL: "unit.text-model-v1:0",
      AI_BEDROCK_REGION: "ap-southeast-1",
      AI_BEDROCK_ACCESS_KEY_ID: ACCESS_KEY_ID,
      AI_BEDROCK_SECRET_ACCESS_KEY: SECRET,
      ...extra,
    }),
  ).ai;
}

const request: AiStepRequest = {
  feature: "unit",
  promptVersion: "v1",
  instructions: "You read purchase orders.",
  messages: [{ role: "user", parts: [{ type: "text", text: "Read this." }] }],
  tools: [],
  maxOutputTokens: 128,
};

interface Seen {
  readonly url: string;
  readonly headers: Headers;
  readonly body: unknown;
}

/** A fetch that records the request and answers like Bedrock's Converse API, or with a failure. */
function recordingFetch(reply: Response = converseReply()): {
  readonly fetch: typeof globalThis.fetch;
  readonly seen: Seen[];
} {
  const seen: Seen[] = [];
  return {
    seen,
    fetch: (input, init) => {
      seen.push({
        url: input instanceof Request ? input.url : String(input),
        headers: new Headers(init?.headers),
        body:
          typeof init?.body === "string"
            ? (JSON.parse(init.body) as unknown)
            : null,
      });
      return Promise.resolve(reply.clone());
    },
  };
}

function converseReply(text = "Done."): Response {
  return new Response(
    JSON.stringify({
      output: { message: { role: "assistant", content: [{ text }] } },
      stopReason: "end_turn",
      usage: { inputTokens: 21, outputTokens: 4, totalTokens: 25 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("the Bedrock provider", () => {
  it("does not load the AWS package until a request needs it", async () => {
    const { fetch } = recordingFetch();
    const before = loads.count;

    const provider = new BedrockLlmProvider(settingsOf(), { fetch });
    expect(loads.count).toBe(before);

    await provider.step(request, SIGNAL);
    expect(loads.count).toBe(before + 1);
    await provider.step(request, SIGNAL);
    expect(loads.count).toBe(before + 1);
  });

  it("names itself for the usage record and the destination policy", () => {
    expect(new BedrockLlmProvider(settingsOf())).toMatchObject({
      name: "bedrock",
      kind: "bedrock",
      model: "unit.text-model-v1:0",
      mock: false,
    });
  });

  it("refuses settings that are not Bedrock's", () => {
    const other = AppConfig.fromEnv(baseEnv()).ai;
    expect(() => new BedrockLlmProvider(other)).toThrow("AI_PROVIDER=mock");
  });

  it("sends a signed request to the region's runtime endpoint, and maps the answer with its usage", async () => {
    const { fetch, seen } = recordingFetch();
    const provider = new BedrockLlmProvider(settingsOf(), { fetch });

    const result = await provider.step(request, SIGNAL);

    expect(result).toEqual({
      text: "Done.",
      toolCalls: [],
      inputTokens: 21,
      outputTokens: 4,
      finishReason: "stop",
    });
    const sent = seen[0];
    expect(sent?.url).toBe(
      "https://bedrock-runtime.ap-southeast-1.amazonaws.com/model/unit.text-model-v1%3A0/converse",
    );
    expect(sent?.headers.get("authorization")).toMatch(
      new RegExp(
        `^AWS4-HMAC-SHA256 Credential=${ACCESS_KEY_ID}/\\d{8}/ap-southeast-1/bedrock/aws4_request`,
      ),
    );
    expect(sent?.headers.get("x-amz-security-token")).toBeNull();
    expect(sent?.body).toMatchObject({
      system: [{ text: "You read purchase orders." }],
      messages: [{ role: "user", content: [{ text: "Read this." }] }],
      inferenceConfig: { maxTokens: 128 },
    });
  });

  it("signs with the session token when there is one", async () => {
    const { fetch, seen } = recordingFetch();
    const provider = new BedrockLlmProvider(
      settingsOf({ AI_BEDROCK_SESSION_TOKEN: SESSION }),
      { fetch },
    );
    await provider.step(request, SIGNAL);
    expect(seen[0]?.headers.get("x-amz-security-token")).toBe(SESSION);
  });

  it("takes its credentials and its endpoint from the settings, never from the process", async () => {
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIAFROMENVIRONMENT");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "from-the-environment");
    vi.stubEnv("AWS_SESSION_TOKEN", "token-from-the-environment");
    vi.stubEnv("AWS_REGION", "eu-west-1");
    vi.stubEnv("AWS_BEARER_TOKEN_BEDROCK", "bearer-from-the-environment");
    vi.stubEnv("AWS_ENDPOINT_URL", "https://elsewhere.example.test");
    vi.stubEnv(
      "AWS_ENDPOINT_URL_BEDROCK_RUNTIME",
      "https://elsewhere.example.test",
    );
    const { fetch, seen } = recordingFetch();
    const provider = new BedrockLlmProvider(settingsOf(), { fetch });

    await provider.step(request, SIGNAL);

    const sent = seen[0];
    expect(
      sent?.url.startsWith("https://bedrock-runtime.ap-southeast-1."),
    ).toBe(true);
    const authorization = sent?.headers.get("authorization") ?? "";
    expect(authorization).toContain(`Credential=${ACCESS_KEY_ID}/`);
    expect(authorization).not.toContain("Bearer");
    expect(authorization).not.toContain("FROMENVIRONMENT");
    expect(sent?.headers.get("x-amz-security-token")).toBeNull();
  });

  it("sends the schema in the request for json_schema, and in the instructions otherwise", async () => {
    const asked = {
      ...request,
      jsonOutput: { name: "extraction", schema: SCHEMA },
    };

    const strict = recordingFetch(converseReply('{"total":42}'));
    await new BedrockLlmProvider(
      settingsOf({ AI_STRUCTURED_OUTPUT: "json_schema" }),
      { fetch: strict.fetch },
    ).step(asked, SIGNAL);
    const strictBody = JSON.stringify(strict.seen[0]?.body);
    expect(strictBody).toContain('"total":{"type":"number"}');

    for (const mode of ["json_object", "prompt"]) {
      const words = recordingFetch(converseReply('{"total":42}'));
      await new BedrockLlmProvider(settingsOf({ AI_STRUCTURED_OUTPUT: mode }), {
        fetch: words.fetch,
      }).step(asked, SIGNAL);
      const body = words.seen[0]?.body as { system: { text: string }[] };
      // Bedrock has no JSON mode, so both of these ask in words only.
      expect(body.system[0]?.text).toContain(JSON.stringify(SCHEMA));
      expect(JSON.stringify(body)).not.toContain("outputConfig");
    }
  });

  it("turns a 429 into the gateway's error, with no body and no secret in it", async () => {
    const marker = "BODY-MARKER-bedrock-0c3e";
    const { fetch } = recordingFetch(
      new Response(JSON.stringify({ message: marker }), {
        status: 429,
        headers: { "content-type": "application/json", "retry-after": "4" },
      }),
    );
    const provider = new BedrockLlmProvider(
      settingsOf({ AI_BEDROCK_SESSION_TOKEN: SESSION }),
      { fetch },
    );

    let failure: unknown;
    try {
      await provider.step(request, SIGNAL);
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(AiProviderError);
    expect(failure).toMatchObject({
      reasonCode: "provider-http-429",
      retryAfterMs: 4000,
    });
    const text = `${String(failure)} ${JSON.stringify(failure)}`;
    for (const secret of [marker, SECRET, SESSION, ACCESS_KEY_ID]) {
      expect(text).not.toContain(secret);
    }
  });
});

describe("the Bedrock endpoint of a region", () => {
  it.each([
    ["ap-southeast-1", "https://bedrock-runtime.ap-southeast-1.amazonaws.com"],
    ["us-east-1", "https://bedrock-runtime.us-east-1.amazonaws.com"],
    ["cn-north-1", "https://bedrock-runtime.cn-north-1.amazonaws.com.cn"],
  ])("%s is %s", (region, url) => {
    expect(bedrockBaseUrlOf(region)).toBe(url);
  });
});
