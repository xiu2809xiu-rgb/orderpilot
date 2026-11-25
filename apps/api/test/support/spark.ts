import {
  sparkAskResponseSchema,
  sparkConversationResponseSchema,
  type SparkAskResult,
} from "@orderpilot/shared";
import { expect } from "vitest";
import {
  LlmProvider,
  type AiStepRequest,
  type AiStepResult,
  type AiStreamPart,
  type AiToolResultPart,
} from "../../src/modules/ai/domain/llm-provider.js";
import {
  MOCK_MODEL,
  MockLlmProvider,
} from "../../src/modules/ai/providers/mock-llm-provider.js";
import { MockScriptRegistry } from "../../src/modules/ai/providers/mock-scripts.js";
import { sparkMockScript } from "../../src/modules/spark/spark.mock-script.js";
import { API, call, type Browser } from "./auth.js";
import type { TestApp } from "./test-app.js";

export const CONVERSATIONS = `${API}/spark/conversations`;

let counter = 0;
export const nextRequestId = (label: string): string =>
  `spark-support-${label}-${String(++counter)}`;

export async function startConversation(
  t: TestApp,
  browser: Browser,
): Promise<string> {
  const res = await call(t, browser, "post", CONVERSATIONS, {
    csrf: true,
    body: {},
  });
  expect(res.status, res.text).toBe(201);
  return sparkConversationResponseSchema.parse(res.body).data.id;
}

/** Asks a question and returns the response, with the request id the audit rows will carry. */
export function askSpark(
  t: TestApp,
  browser: Browser,
  id: string,
  question: string,
  requestId = nextRequestId("ask"),
) {
  return call(t, browser, "post", `${CONVERSATIONS}/${id}/messages`, {
    csrf: true,
    body: { question },
  }).set("X-Request-Id", requestId);
}

/** Asks and expects the 201 every answer has, failed or not. */
export async function askOk(
  t: TestApp,
  browser: Browser,
  id: string,
  question: string,
  requestId?: string,
): Promise<SparkAskResult> {
  const res = await askSpark(t, browser, id, question, requestId);
  expect(res.status, res.text).toBe(201);
  return sparkAskResponseSchema.parse(res.body).data;
}

/** A provider scripted step by step, that records every request it is sent. */
export class ScriptedProvider extends LlmProvider {
  readonly name = "mock" as const;
  readonly kind = "mock" as const;
  readonly model = "scripted-spark-model";
  readonly mock = true;
  readonly requests: AiStepRequest[] = [];

  constructor(
    private readonly script: (request: AiStepRequest) => Partial<AiStepResult>,
  ) {
    super();
  }

  step(request: AiStepRequest): Promise<AiStepResult> {
    this.requests.push(request);
    const reply = this.script(request);
    const toolCalls = reply.toolCalls ?? [];
    return Promise.resolve({
      text: reply.text ?? "",
      model: this.model,
      toolCalls,
      inputTokens: 5,
      outputTokens: 2,
      finishReason: toolCalls.length > 0 ? "tool-calls" : "stop",
    });
  }

  async *stream(request: AiStepRequest): AsyncIterable<AiStreamPart> {
    const step = await this.step(request);
    if (step.text !== "") yield { type: "text-delta", text: step.text };
    for (const toolCall of step.toolCalls) {
      yield { type: "tool-call", call: toolCall };
    }
    yield {
      type: "finish",
      model: step.model,
      inputTokens: step.inputTokens,
      outputTokens: step.outputTokens,
      finishReason: step.finishReason,
    };
  }
}

/** Spark's own offline script behind a recorder: the real answers, and every request kept. */
export class RecordingMockProvider extends LlmProvider {
  readonly name = "mock" as const;
  readonly kind = "mock" as const;
  readonly model = MOCK_MODEL;
  readonly mock = true;
  readonly requests: AiStepRequest[] = [];
  private readonly inner = new MockLlmProvider(
    new MockScriptRegistry().register("spark", sparkMockScript),
  );

  step(request: AiStepRequest, signal: AbortSignal): Promise<AiStepResult> {
    this.requests.push(request);
    return this.inner.step(request, signal);
  }

  stream(
    request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncIterable<AiStreamPart> {
    this.requests.push(request);
    return this.inner.stream(request, signal);
  }
}

/** Every tool result any request carried, once each. */
export function toolResultsIn(
  requests: readonly AiStepRequest[],
): AiToolResultPart[] {
  const seen = new Map<string, AiToolResultPart>();
  for (const request of requests) {
    for (const message of request.messages) {
      if (message.role !== "tool") continue;
      for (const part of message.parts)
        seen.set(`${part.id}|${part.output}`, part);
    }
  }
  return [...seen.values()];
}

/** Every string and every key in a JSON value, however deep. */
export function leavesOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") {
    return [String(value)];
  }
  if (Array.isArray(value)) return (value as unknown[]).flatMap(leavesOf);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) => [
      key,
      ...leavesOf(inner),
    ]);
  }
  return [];
}
