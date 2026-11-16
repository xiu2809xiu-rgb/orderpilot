import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeChatServer } from "../../../../test/support/fake-chat-server.js";
import { baseEnv } from "../../../../test/support/base-env.js";
import { AppConfig } from "../../../config/app-config.js";
import { AiImageLimitError } from "../domain/ai-errors.js";
import type {
  AiStepRequest,
  AiStreamPart,
  JsonSchema,
} from "../domain/llm-provider.js";
import {
  OpenAiCompatibleLlmProvider,
  PRESET_BASE_URLS,
} from "./openai-compatible-llm-provider.js";

const KEY = "sk-test-marker-9f3a";
const SIGNAL = new AbortController().signal;

const SCHEMA: JsonSchema = {
  type: "object",
  properties: { total: { type: "number" } },
  required: ["total"],
};

let server: FakeChatServer;

beforeEach(async () => {
  server = await FakeChatServer.start();
});

afterEach(async () => {
  await server.close();
});

function settingsOf(extra: NodeJS.ProcessEnv = {}): AppConfig["ai"] {
  return AppConfig.fromEnv(
    baseEnv({
      AI_PROVIDER: "openai-compatible",
      AI_BASE_URL: server.baseUrl,
      AI_API_KEY: KEY,
      AI_MODEL: "text-model",
      ...extra,
    }),
  ).ai;
}

function requestOf(overrides: Partial<AiStepRequest> = {}): AiStepRequest {
  return {
    feature: "unit",
    promptVersion: "v1",
    instructions: "You read purchase orders.",
    messages: [{ role: "user", parts: [{ type: "text", text: "Read this." }] }],
    tools: [],
    maxOutputTokens: 256,
    ...overrides,
  };
}

async function collect(
  parts: AsyncIterable<AiStreamPart>,
): Promise<AiStreamPart[]> {
  const seen: AiStreamPart[] = [];
  for await (const part of parts) seen.push(part);
  return seen;
}

describe("the OpenAI-compatible provider, on the wire", () => {
  it("names itself for the usage record and the destination policy", () => {
    const provider = new OpenAiCompatibleLlmProvider(settingsOf());
    expect(provider).toMatchObject({
      name: "openai-compatible",
      kind: "openai-compatible",
      model: "text-model",
      mock: false,
    });
  });

  it("posts the key in the Authorization header and the model, messages and cap in the body", async () => {
    server.reply({
      kind: "completion",
      content: "Done.",
      usage: { promptTokens: 12, completionTokens: 3 },
    });
    const provider = new OpenAiCompatibleLlmProvider(settingsOf());

    await provider.step(requestOf(), SIGNAL);

    const sent = server.lastRequest;
    expect(sent.method).toBe("POST");
    expect(sent.path).toBe("/v1/chat/completions");
    expect(sent.headers.authorization).toBe(`Bearer ${KEY}`);
    expect(sent.body).toMatchObject({
      model: "text-model",
      max_tokens: 256,
      messages: [
        { role: "system", content: "You read purchase orders." },
        { role: "user", content: "Read this." },
      ],
    });
    // A plain text call asks for nothing else: no tools and no JSON mode.
    expect(sent.body).not.toHaveProperty("tools");
    expect(sent.body).not.toHaveProperty("response_format");
  });

  it("sends no Authorization header when the server needs no key", async () => {
    server.reply({ kind: "completion", content: "ok" });
    const provider = new OpenAiCompatibleLlmProvider(
      settingsOf({ AI_API_KEY: "" }),
    );
    await provider.step(requestOf(), SIGNAL);
    expect(server.lastRequest.headers.authorization).toBeUndefined();
  });

  it("maps a text answer back to the port with its token usage", async () => {
    server.reply({
      kind: "completion",
      content: "The total is 42.",
      usage: { promptTokens: 120, completionTokens: 9 },
    });
    const provider = new OpenAiCompatibleLlmProvider(settingsOf());

    const result = await provider.step(requestOf(), SIGNAL);

    expect(result).toEqual({
      text: "The total is 42.",
      model: "text-model",
      toolCalls: [],
      inputTokens: 120,
      outputTokens: 9,
      finishReason: "stop",
    });
  });

  it("reports zero tokens when the server sends no usage, rather than inventing a number", async () => {
    server.reply({ kind: "completion", content: "ok" });
    const provider = new OpenAiCompatibleLlmProvider(settingsOf());
    const result = await provider.step(requestOf(), SIGNAL);
    expect(result.inputTokens).toBe(0);
    expect(result.outputTokens).toBe(0);
  });

  it("maps a length finish and an unknown finish", async () => {
    server.reply(
      { kind: "completion", content: "cut", finishReason: "length" },
      { kind: "completion", content: "x", finishReason: "something-new" },
    );
    const provider = new OpenAiCompatibleLlmProvider(settingsOf());
    expect((await provider.step(requestOf(), SIGNAL)).finishReason).toBe(
      "length",
    );
    expect((await provider.step(requestOf(), SIGNAL)).finishReason).toBe(
      "other",
    );
  });

  describe("images", () => {
    const image = {
      type: "image" as const,
      mediaType: "image/png" as const,
      dataBase64: "iVBORw0KGgo=",
    };

    it("sends a page image as a data URL, to the vision model", async () => {
      server.reply({ kind: "completion", content: "ok" });
      const provider = new OpenAiCompatibleLlmProvider(
        settingsOf({ AI_VISION_MODEL: "vision-model" }),
      );

      await provider.step(
        requestOf({
          messages: [
            {
              role: "user",
              parts: [{ type: "text", text: "What is on this page?" }, image],
            },
          ],
        }),
        SIGNAL,
      );

      expect(server.lastRequest.body).toMatchObject({
        model: "vision-model",
        messages: [
          { role: "system" },
          {
            role: "user",
            content: [
              { type: "text", text: "What is on this page?" },
              {
                type: "image_url",
                image_url: { url: "data:image/png;base64,iVBORw0KGgo=" },
              },
            ],
          },
        ],
      });
    });

    it("reports the model that answered: the vision model for a page, the text model otherwise", async () => {
      server.reply({ kind: "completion", content: "ok" });
      server.reply({ kind: "stream", deltas: ["ok"] });
      server.reply({ kind: "completion", content: "ok" });
      const provider = new OpenAiCompatibleLlmProvider(
        settingsOf({ AI_VISION_MODEL: "vision-model" }),
      );
      const page = requestOf({
        messages: [{ role: "user", parts: [image] }],
      });
      expect((await provider.step(page, SIGNAL)).model).toBe("vision-model");
      const parts = await collect(provider.stream(page, SIGNAL));
      expect(parts.at(-1)).toMatchObject({
        type: "finish",
        model: "vision-model",
      });
      expect((await provider.step(requestOf(), SIGNAL)).model).toBe(
        "text-model",
      );
    });

    it("uses the text model for a page when there is no vision model", async () => {
      server.reply({ kind: "completion", content: "ok" });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());
      await provider.step(
        requestOf({ messages: [{ role: "user", parts: [image] }] }),
        SIGNAL,
      );
      expect(server.lastRequest.body).toMatchObject({ model: "text-model" });
    });

    it("refuses more images than the cap before anything is sent", async () => {
      const provider = new OpenAiCompatibleLlmProvider(
        settingsOf({ AI_MAX_IMAGES_PER_REQUEST: "2" }),
      );
      const parts = [image, image, image];
      await expect(
        provider.step(
          requestOf({ messages: [{ role: "user", parts }] }),
          SIGNAL,
        ),
      ).rejects.toBeInstanceOf(AiImageLimitError);
      await expect(
        collect(
          provider.stream(
            requestOf({ messages: [{ role: "user", parts }] }),
            SIGNAL,
          ),
        ),
      ).rejects.toBeInstanceOf(AiImageLimitError);
      expect(server.requests).toHaveLength(0);
    });
  });

  describe("how JSON is asked for (AI_STRUCTURED_OUTPUT)", () => {
    const jsonRequest = requestOf({
      jsonOutput: { name: "extraction", schema: SCHEMA },
    });

    it("json_schema carries the schema in a json_schema response format", async () => {
      server.reply({ kind: "completion", content: '{"total":42}' });
      const provider = new OpenAiCompatibleLlmProvider(
        settingsOf({ AI_STRUCTURED_OUTPUT: "json_schema" }),
      );

      const result = await provider.step(jsonRequest, SIGNAL);

      expect(server.lastRequest.body).toMatchObject({
        response_format: {
          type: "json_schema",
          json_schema: { name: "extraction", schema: SCHEMA },
        },
      });
      // The answer comes back as text: zod, in the gateway, decides if it is valid.
      expect(result.text).toBe('{"total":42}');
    });

    it("json_object asks for JSON mode, and the schema goes in the instructions", async () => {
      server.reply({ kind: "completion", content: '{"total":42}' });
      const provider = new OpenAiCompatibleLlmProvider(
        settingsOf({ AI_STRUCTURED_OUTPUT: "json_object" }),
      );

      await provider.step(jsonRequest, SIGNAL);

      const body = server.lastRequest.body as {
        response_format: unknown;
        messages: { role: string; content: string }[];
      };
      expect(body.response_format).toEqual({ type: "json_object" });
      const system = body.messages[0]?.content ?? "";
      expect(system).toContain("You read purchase orders.");
      expect(system).toContain(JSON.stringify(SCHEMA));
      expect(system).toContain("JSON");
    });

    it("prompt sends no response format at all, only the schema in the instructions", async () => {
      server.reply({ kind: "completion", content: '{"total":42}' });
      const provider = new OpenAiCompatibleLlmProvider(
        settingsOf({ AI_STRUCTURED_OUTPUT: "prompt" }),
      );

      await provider.step(jsonRequest, SIGNAL);

      const body = server.lastRequest.body as {
        messages: { role: string; content: string }[];
      };
      expect(body).not.toHaveProperty("response_format");
      expect(body.messages[0]?.content).toContain(JSON.stringify(SCHEMA));
    });

    it("hands an answer that is not JSON on as text, for the gateway to refuse and ask again", async () => {
      server.reply({ kind: "completion", content: "Sorry, I cannot." });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());
      const result = await provider.step(jsonRequest, SIGNAL);
      expect(result.text).toBe("Sorry, I cannot.");
    });
  });

  describe("tools", () => {
    const tools = [
      {
        name: "find_item",
        description: "Looks up an item by its number.",
        inputSchema: {
          type: "object",
          properties: { itemNo: { type: "string" } },
          required: ["itemNo"],
        } satisfies JsonSchema,
      },
    ];

    it("sends each tool as a function spec with no way to run it", async () => {
      server.reply({ kind: "completion", content: "ok" });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());

      await provider.step(requestOf({ tools }), SIGNAL);

      expect(server.lastRequest.body).toMatchObject({
        tools: [
          {
            type: "function",
            function: {
              name: "find_item",
              description: "Looks up an item by its number.",
              parameters: tools[0]?.inputSchema,
            },
          },
        ],
      });
    });

    it("returns the tool calls the model asked for and runs nothing", async () => {
      server.reply({
        kind: "completion",
        content: null,
        toolCalls: [
          {
            id: "call_1",
            name: "find_item",
            arguments: '{"itemNo":"IT-0001"}',
          },
        ],
        usage: { promptTokens: 50, completionTokens: 8 },
      });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());

      const result = await provider.step(requestOf({ tools }), SIGNAL);

      expect(result.finishReason).toBe("tool-calls");
      expect(result.toolCalls).toEqual([
        { id: "call_1", name: "find_item", input: { itemNo: "IT-0001" } },
      ]);
      expect(result.inputTokens).toBe(50);
      expect(server.requests).toHaveLength(1);
    });

    it("passes a tool the call did not list on by name, so the loop can refuse and audit it", async () => {
      server.reply({
        kind: "completion",
        toolCalls: [
          { id: "call_9", name: "approve_spr", arguments: '{"sprId":"x"}' },
        ],
      });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());

      const result = await provider.step(requestOf({ tools }), SIGNAL);

      expect(result.toolCalls).toEqual([
        { id: "call_9", name: "approve_spr", input: { sprId: "x" } },
      ]);
    });

    it("turns arguments that are not JSON into a null input, which the loop tells the model is invalid", async () => {
      server.reply({
        kind: "completion",
        toolCalls: [
          { id: "call_2", name: "find_item", arguments: '{"itemNo": ' },
        ],
      });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());

      const result = await provider.step(requestOf({ tools }), SIGNAL);

      expect(result.toolCalls).toEqual([
        { id: "call_2", name: "find_item", input: null },
      ]);
    });

    it("sends an earlier call and its result back to the model, an error as an error", async () => {
      server.reply({ kind: "completion", content: "Fine." });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());

      await provider.step(
        requestOf({
          tools,
          messages: [
            { role: "user", parts: [{ type: "text", text: "Go." }] },
            {
              role: "assistant",
              parts: [
                {
                  type: "tool-call",
                  id: "call_1",
                  name: "find_item",
                  input: { itemNo: "IT-0001" },
                },
              ],
            },
            {
              role: "tool",
              parts: [
                {
                  type: "tool-result",
                  id: "call_1",
                  name: "find_item",
                  output: "[tool error] not allowed",
                  isError: true,
                },
              ],
            },
          ],
        }),
        SIGNAL,
      );

      expect(server.lastRequest.body).toMatchObject({
        messages: [
          { role: "system" },
          { role: "user", content: "Go." },
          {
            role: "assistant",
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: {
                  name: "find_item",
                  arguments: '{"itemNo":"IT-0001"}',
                },
              },
            ],
          },
          {
            role: "tool",
            tool_call_id: "call_1",
            content: "[tool error] not allowed",
          },
        ],
      });
    });
  });

  describe("streams", () => {
    it("asks for token usage on the stream, and maps deltas and the final part", async () => {
      server.reply({
        kind: "stream",
        deltas: ["The total ", "is 42."],
        usage: { promptTokens: 30, completionTokens: 5 },
      });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());

      const parts = await collect(provider.stream(requestOf(), SIGNAL));

      expect(server.lastRequest.body).toMatchObject({
        stream: true,
        stream_options: { include_usage: true },
      });
      expect(server.lastRequest.headers.authorization).toBe(`Bearer ${KEY}`);
      expect(parts).toEqual([
        { type: "text-delta", text: "The total " },
        { type: "text-delta", text: "is 42." },
        {
          type: "finish",
          model: "text-model",
          inputTokens: 30,
          outputTokens: 5,
          finishReason: "stop",
        },
      ]);
    });

    it("assembles a tool call that arrives in pieces", async () => {
      server.reply({
        kind: "stream",
        toolCalls: [
          {
            id: "call_3",
            name: "find_item",
            arguments: '{"itemNo":"IT-0002"}',
          },
        ],
        usage: { promptTokens: 40, completionTokens: 6 },
      });
      const provider = new OpenAiCompatibleLlmProvider(settingsOf());

      const parts = await collect(provider.stream(requestOf(), SIGNAL));

      expect(parts).toContainEqual({
        type: "tool-call",
        call: { id: "call_3", name: "find_item", input: { itemNo: "IT-0002" } },
      });
      expect(parts.at(-1)).toMatchObject({
        type: "finish",
        finishReason: "tool-calls",
        inputTokens: 40,
        outputTokens: 6,
      });
    });
  });
});

describe("the gemini and groq presets", () => {
  /** Captures what the preset would call, without a network. */
  async function urlCalledBy(
    name: "gemini" | "groq",
    env: NodeJS.ProcessEnv,
  ): Promise<{ url: string; authorization: string | null }> {
    let seen = { url: "", authorization: null as string | null };
    const provider = new OpenAiCompatibleLlmProvider(
      AppConfig.fromEnv(baseEnv({ AI_PROVIDER: name, ...env })).ai,
      {
        fetch: (input, init) => {
          seen = {
            url: input instanceof Request ? input.url : String(input),
            authorization: new Headers(init?.headers).get("authorization"),
          };
          return Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    index: 0,
                    message: { role: "assistant", content: "ok" },
                    finish_reason: "stop",
                  },
                ],
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            ),
          );
        },
      },
    );
    await provider.step(requestOf(), SIGNAL);
    return seen;
  }

  it("carries the known base URLs", () => {
    expect(PRESET_BASE_URLS).toEqual({
      gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
      groq: "https://api.groq.com/openai/v1",
    });
  });

  it("calls Gemini at its compatible endpoint with GEMINI_API_KEY", async () => {
    const seen = await urlCalledBy("gemini", {
      GEMINI_API_KEY: "gem-key",
      AI_MODEL: "gem-model",
    });
    expect(seen.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
    expect(seen.authorization).toBe("Bearer gem-key");
  });

  it("calls Groq at its compatible endpoint with GROQ_API_KEY", async () => {
    const seen = await urlCalledBy("groq", {
      GROQ_API_KEY: "groq-key",
      AI_MODEL: "groq-model",
    });
    expect(seen.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(seen.authorization).toBe("Bearer groq-key");
  });

  it("keeps the name of the setting, which the usage record stores", () => {
    const provider = new OpenAiCompatibleLlmProvider(
      AppConfig.fromEnv(
        baseEnv({
          AI_PROVIDER: "groq",
          GROQ_API_KEY: "k",
          AI_MODEL: "m",
        }),
      ).ai,
    );
    expect(provider.name).toBe("groq");
    expect(provider.kind).toBe("openai-compatible");
  });
});
