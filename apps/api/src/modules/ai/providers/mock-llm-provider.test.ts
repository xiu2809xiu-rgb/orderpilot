import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AiMockScriptMissingError,
  AiProviderError,
} from "../domain/ai-errors.js";
import {
  LlmProvider,
  type AiMessage,
  type AiStepRequest,
  type AiStreamPart,
} from "../domain/llm-provider.js";
import { MOCK_MODEL, MockLlmProvider } from "./mock-llm-provider.js";
import {
  GATEWAY_PROBE_FEATURE,
  GATEWAY_PROBE_OBJECT,
  GATEWAY_PROBE_TEXT,
  MockScriptRegistry,
  createProductionMockScripts,
  mockChunks,
  mockJson,
  mockText,
  mockToolCalls,
} from "./mock-scripts.js";

const signal = new AbortController().signal;

function requestFor(
  feature: string,
  overrides: Partial<AiStepRequest> = {},
): AiStepRequest {
  return {
    feature,
    promptVersion: "v1",
    instructions: "Do the task.",
    messages: [{ role: "user", parts: [{ type: "text", text: "Hello" }] }],
    tools: [],
    maxOutputTokens: 256,
    ...overrides,
  };
}

async function collect(
  parts: AsyncIterable<AiStreamPart>,
): Promise<AiStreamPart[]> {
  const out: AiStreamPart[] = [];
  for await (const part of parts) out.push(part);
  return out;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the mock provider", () => {
  const provider = new MockLlmProvider(createProductionMockScripts());

  it("says what it is, for the usage record, the policy and the Mock AI badge", () => {
    expect(provider).toBeInstanceOf(LlmProvider);
    expect(provider.name).toBe("mock");
    expect(provider.kind).toBe("mock");
    expect(provider.mock).toBe(true);
    expect(provider.model).toBe(MOCK_MODEL);
  });

  it("answers the probe in text", async () => {
    const result = await provider.step(
      requestFor(GATEWAY_PROBE_FEATURE),
      signal,
    );
    expect(result.text).toBe(GATEWAY_PROBE_TEXT);
    expect(result.finishReason).toBe("stop");
    expect(result.toolCalls).toEqual([]);
  });

  it("answers the probe with an object when JSON is asked for", async () => {
    const result = await provider.step(
      requestFor(GATEWAY_PROBE_FEATURE, {
        jsonOutput: { name: "probe", schema: { type: "object" } },
      }),
      signal,
    );
    expect(JSON.parse(result.text)).toEqual(GATEWAY_PROBE_OBJECT);
  });
});

describe("a feature with no script", () => {
  const provider = new MockLlmProvider(createProductionMockScripts());

  it("fails loudly in a step, naming the feature, and invents nothing", async () => {
    const attempt = provider.step(requestFor("document-extraction"), signal);
    await expect(attempt).rejects.toBeInstanceOf(AiMockScriptMissingError);
    await expect(attempt).rejects.toThrow('"document-extraction"');
    await expect(attempt).rejects.toMatchObject({
      reasonCode: "mock-script-missing",
    });
  });

  it("fails loudly in a stream too, on the first read", async () => {
    await expect(
      collect(provider.stream(requestFor("spark"), signal)),
    ).rejects.toThrow('"spark"');
    await expect(
      collect(provider.stream(requestFor("spark"), signal)),
    ).rejects.toBeInstanceOf(AiProviderError);
  });
});

describe("determinism", () => {
  const scripts = new MockScriptRegistry()
    .register("echo", (context) => mockText(`You said: ${context.userText}`))
    .register("shape", () => mockJson({ qty: 5, lines: [{ sku: "A" }] }))
    .register("lookup", (context) =>
      context.toolResults.length === 0
        ? mockToolCalls([{ name: "stock-lookup", input: { sku: "A" } }])
        : mockText("Done"),
    );

  it("gives identical output for identical input, from separate providers", async () => {
    const a = new MockLlmProvider(scripts);
    const b = new MockLlmProvider(scripts);
    const request = requestFor("echo");
    const first = await a.step(request, signal);
    expect(await a.step(request, signal)).toEqual(first);
    expect(await b.step(structuredClone(request), signal)).toEqual(first);
    expect(await collect(a.stream(request, signal))).toEqual(
      await collect(b.stream(request, signal)),
    );
  });

  it("counts tokens as a fixed function of the text lengths", async () => {
    const provider = new MockLlmProvider(scripts);
    const short = await provider.step(requestFor("echo"), signal);
    const long = await provider.step(
      requestFor("echo", {
        messages: [
          { role: "user", parts: [{ type: "text", text: "Hello".repeat(80) }] },
        ],
      }),
      signal,
    );
    expect(short.inputTokens).toBeGreaterThan(0);
    expect(short.outputTokens).toBeGreaterThan(0);
    expect(long.inputTokens).toBeGreaterThan(short.inputTokens);
    expect(long.outputTokens).toBeGreaterThan(short.outputTokens);
    // 12 characters of instructions plus 5 of text is 17 characters: 5 tokens.
    expect(short.inputTokens).toBe(5);
    // "You said: Hello" is 15 characters: 4 tokens.
    expect(short.outputTokens).toBe(4);
  });

  it("counts a page image as a fixed number of input tokens", async () => {
    const provider = new MockLlmProvider(scripts);
    const without = await provider.step(requestFor("echo"), signal);
    const withImage = await provider.step(
      requestFor("echo", {
        messages: [
          {
            role: "user",
            parts: [
              { type: "text", text: "Hello" },
              { type: "image", mediaType: "image/png", dataBase64: "AAAA" },
            ],
          },
        ],
      }),
      signal,
    );
    expect(withImage.inputTokens - without.inputTokens).toBe(85);
  });

  it("plays a JSON answer as text that parses back to the value", async () => {
    const result = await new MockLlmProvider(scripts).step(
      requestFor("shape"),
      signal,
    );
    expect(JSON.parse(result.text)).toEqual({ qty: 5, lines: [{ sku: "A" }] });
  });
});

describe("tool calls", () => {
  const scripts = new MockScriptRegistry().register("lookup", (context) =>
    context.toolResults.length === 0
      ? mockToolCalls(
          [
            { name: "stock-lookup", input: { sku: "A" } },
            { name: "price-lookup", input: { sku: "B" } },
          ],
          "Checking",
        )
      : mockText(`Result: ${context.toolResults[0]?.output ?? ""}`),
  );
  const provider = new MockLlmProvider(scripts);

  it("scripts calls with repeatable ids and a tool-calls finish", async () => {
    const result = await provider.step(requestFor("lookup"), signal);
    expect(result.finishReason).toBe("tool-calls");
    expect(result.text).toBe("Checking");
    expect(result.toolCalls).toEqual([
      { id: "mock-call-0-0", name: "stock-lookup", input: { sku: "A" } },
      { id: "mock-call-0-1", name: "price-lookup", input: { sku: "B" } },
    ]);
  });

  it("goes on to its answer once the tool results are in the messages", async () => {
    const messages: AiMessage[] = [
      { role: "user", parts: [{ type: "text", text: "Hello" }] },
      {
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            id: "mock-call-0-0",
            name: "stock-lookup",
            input: { sku: "A" },
          },
        ],
      },
      {
        role: "tool",
        parts: [
          {
            type: "tool-result",
            id: "mock-call-0-0",
            name: "stock-lookup",
            output: "12 on hand",
            isError: false,
          },
        ],
      },
    ];
    const result = await provider.step(
      requestFor("lookup", { messages }),
      signal,
    );
    expect(result.finishReason).toBe("stop");
    expect(result.text).toBe("Result: 12 on hand");
  });

  it("tells a script how many assistant turns came before, for a retry", async () => {
    const retrying = new MockLlmProvider(
      new MockScriptRegistry().register("retry", (context) =>
        context.turn === 0 ? mockText("not json") : mockJson({ ok: true }),
      ),
    );
    const first = await retrying.step(requestFor("retry"), signal);
    expect(first.text).toBe("not json");
    const second = await retrying.step(
      requestFor("retry", {
        messages: [
          { role: "user", parts: [{ type: "text", text: "Hello" }] },
          { role: "assistant", parts: [{ type: "text", text: first.text }] },
          { role: "user", parts: [{ type: "text", text: "Answer in JSON." }] },
        ],
      }),
      signal,
    );
    expect(JSON.parse(second.text)).toEqual({ ok: true });
  });

  it("streams the same calls, then finishes with the same figures", async () => {
    const step = await provider.step(requestFor("lookup"), signal);
    const parts = await collect(provider.stream(requestFor("lookup"), signal));
    expect(parts.filter((part) => part.type === "tool-call")).toHaveLength(2);
    expect(parts.at(-1)).toEqual({
      type: "finish",
      inputTokens: step.inputTokens,
      outputTokens: step.outputTokens,
      finishReason: "tool-calls",
    });
  });
});

describe("streamed chunks", () => {
  const scripts = new MockScriptRegistry()
    .register("spark", () => mockChunks("Stock for ", "SKU-1 is ", "12."))
    .register("long", () => mockText("a".repeat(40)))
    .register("empty", () => mockText(""));
  const provider = new MockLlmProvider(scripts);

  it("yields the script's chunks as deltas, then one finish part", async () => {
    const parts = await collect(provider.stream(requestFor("spark"), signal));
    expect(parts.map((part) => part.type)).toEqual([
      "text-delta",
      "text-delta",
      "text-delta",
      "finish",
    ]);
    expect(
      parts.flatMap((part) => (part.type === "text-delta" ? [part.text] : [])),
    ).toEqual(["Stock for ", "SKU-1 is ", "12."]);
  });

  it("returns the same chunks joined from a step", async () => {
    const step = await provider.step(requestFor("spark"), signal);
    expect(step.text).toBe("Stock for SKU-1 is 12.");
    const parts = await collect(provider.stream(requestFor("spark"), signal));
    expect(parts.at(-1)).toMatchObject({
      outputTokens: step.outputTokens,
      inputTokens: step.inputTokens,
    });
  });

  it("splits plain text into steady chunks that join back to the text", async () => {
    const parts = await collect(provider.stream(requestFor("long"), signal));
    const deltas = parts.flatMap((part) =>
      part.type === "text-delta" ? [part.text] : [],
    );
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toBe("a".repeat(40));
  });

  it("does not split a character in two", async () => {
    const emoji = new MockLlmProvider(
      new MockScriptRegistry().register("wide", () =>
        mockText("\u{1F600}".repeat(20)),
      ),
    );
    const parts = await collect(emoji.stream(requestFor("wide"), signal));
    for (const part of parts) {
      if (part.type === "text-delta") {
        expect(Array.from(part.text).every((c) => c === "\u{1F600}")).toBe(
          true,
        );
      }
    }
  });

  it("yields only the finish part for an empty answer", async () => {
    const parts = await collect(provider.stream(requestFor("empty"), signal));
    expect(parts.map((part) => part.type)).toEqual(["finish"]);
  });
});

describe("an aborted call", () => {
  const provider = new MockLlmProvider(createProductionMockScripts());

  it("rejects a step whose signal has already fired", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(
      provider.step(requestFor(GATEWAY_PROBE_FEATURE), controller.signal),
    ).rejects.toThrow("cancelled");
  });

  it("stops a stream between chunks when its signal fires", async () => {
    const controller = new AbortController();
    const slow = new MockLlmProvider(
      new MockScriptRegistry().register("slow", () =>
        mockText("x".repeat(100)),
      ),
    );
    const seen: AiStreamPart[] = [];
    await expect(
      (async () => {
        for await (const part of slow.stream(
          requestFor("slow"),
          controller.signal,
        )) {
          seen.push(part);
          controller.abort(new Error("stop"));
        }
      })(),
    ).rejects.toThrow("stop");
    expect(seen).toHaveLength(1);
  });
});

describe("with every key absent and the network refusing", () => {
  it("still works: it reaches for no network and reads no environment", async () => {
    const fetchStub = vi.fn(() => {
      throw new Error("the mock must not use the network");
    });
    vi.stubGlobal("fetch", fetchStub);
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("GROQ_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("AI_API_KEY", "");
    const provider = new MockLlmProvider(createProductionMockScripts());
    const result = await provider.step(
      requestFor(GATEWAY_PROBE_FEATURE),
      signal,
    );
    await collect(provider.stream(requestFor(GATEWAY_PROBE_FEATURE), signal));
    expect(result.text).toBe(GATEWAY_PROBE_TEXT);
    expect(fetchStub).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("holds no network, SDK, environment, clock or random code in its source", () => {
    const dir = resolve(import.meta.dirname);
    for (const file of ["mock-llm-provider.ts", "mock-scripts.ts"]) {
      const source = readFileSync(resolve(dir, file), "utf8");
      for (const forbidden of [
        "fetch(",
        "node:http",
        "node:https",
        "node:net",
        "process.env",
        "Date.now",
        "Math.random",
        "node:crypto",
        "@ai-sdk",
        'from "ai"',
      ]) {
        expect(source, `${file} contains ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });
});
