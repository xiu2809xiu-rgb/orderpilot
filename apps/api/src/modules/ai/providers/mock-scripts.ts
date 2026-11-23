import type {
  AiStepRequest,
  AiToolResultPart,
  JsonValue,
} from "../domain/llm-provider.js";

// The mock never invents an answer. It plays a script registered for the
// feature, and a feature with no script fails loudly (AiMockScriptMissingError).
// Each feature's story registers its own script, so a screen that shows "Mock
// AI" shows what that feature's author chose. A script is a plain function of
// what the mock was asked, so the same input gives the same output.

/** What a script is told about the request in front of it. */
export interface MockScriptContext {
  readonly request: AiStepRequest;
  /** How many assistant messages came before: 0 on the first step, and again 1 after a retry or a tool result. */
  readonly turn: number;
  /** Every text part of every user message, joined by a line break. Fenced documents are in here. */
  readonly userText: string;
  /** Every tool result so far, in order. */
  readonly toolResults: readonly AiToolResultPart[];
}

export interface MockToolCallScript {
  readonly name: string;
  readonly input: JsonValue;
}

export type MockReply =
  | { readonly kind: "text"; readonly text: string }
  /** A streamed answer: `stream` yields one delta per chunk, `step` returns them joined. */
  | { readonly kind: "chunks"; readonly chunks: readonly string[] }
  /** An answer in JSON, as text. Use `text` to script an answer that is NOT valid JSON. */
  | { readonly kind: "json"; readonly value: JsonValue }
  | {
      readonly kind: "tool-calls";
      readonly calls: readonly MockToolCallScript[];
      readonly text?: string;
    };

export type MockScript = (context: MockScriptContext) => MockReply;

export const mockText = (text: string): MockReply => ({ kind: "text", text });
export const mockChunks = (...chunks: string[]): MockReply => ({
  kind: "chunks",
  chunks,
});
export const mockJson = (value: JsonValue): MockReply => ({
  kind: "json",
  value,
});
export const mockToolCalls = (
  calls: readonly MockToolCallScript[],
  text?: string,
): MockReply =>
  text === undefined
    ? { kind: "tool-calls", calls }
    : { kind: "tool-calls", calls, text };

const FEATURE_NAME = /^[a-z][a-z0-9-]{0,59}$/;

/** The scripts of one mock provider, keyed by feature. */
export class MockScriptRegistry {
  private readonly scripts = new Map<string, MockScript>();

  /** Registers a feature's script. A second script for a feature is a mistake, so it throws. */
  register(feature: string, script: MockScript): this {
    if (!FEATURE_NAME.test(feature)) {
      throw new RangeError(
        "A feature name is lower case letters, digits and hyphens, starting with a letter.",
      );
    }
    if (this.scripts.has(feature)) {
      throw new Error(`A mock script for "${feature}" is already registered.`);
    }
    this.scripts.set(feature, script);
    return this;
  }

  get(feature: string): MockScript | undefined {
    return this.scripts.get(feature);
  }

  features(): string[] {
    return [...this.scripts.keys()].sort();
  }
}

/** The one feature production registers: the probe route and the key check. */
export const GATEWAY_PROBE_FEATURE = "gateway-probe";
export const GATEWAY_PROBE_TEXT =
  "Gateway probe: the mock provider is answering.";
/** The structured probe answers with this. Its schema must accept a `status` string. */
export const GATEWAY_PROBE_OBJECT = { status: "ok" } as const;

/**
 * The scripts a running API has. Only the probe: a feature that wants a mock
 * answer registers its own script in its own story, and a test registers what
 * it needs in a registry of its own.
 */
export function createProductionMockScripts(): MockScriptRegistry {
  return new MockScriptRegistry().register(GATEWAY_PROBE_FEATURE, (context) =>
    context.request.jsonOutput
      ? mockJson(GATEWAY_PROBE_OBJECT)
      : mockText(GATEWAY_PROBE_TEXT),
  );
}
