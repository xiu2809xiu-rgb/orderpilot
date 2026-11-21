import { describe, expect, it } from "vitest";
import {
  FINISH_REASONS,
  LlmProvider,
  type AiStepRequest,
  type AiStepResult,
  type AiStreamPart,
} from "./llm-provider.js";

class FakeProvider extends LlmProvider {
  readonly name = "mock" as const;
  readonly kind = "mock" as const;
  readonly model = "fake-1";
  readonly mock = true;

  step(request: AiStepRequest): Promise<AiStepResult> {
    return Promise.resolve({
      text: request.instructions,
      model: "fake-1",
      toolCalls: [],
      inputTokens: 1,
      outputTokens: 1,
      finishReason: "stop",
    });
  }

  async *stream(): AsyncIterable<AiStreamPart> {
    await Promise.resolve();
    yield { type: "text-delta", text: "a" };
    yield {
      type: "finish",
      model: "fake-1",
      inputTokens: 1,
      outputTokens: 1,
      finishReason: "stop",
    };
  }
}

describe("the LlmProvider port", () => {
  it("is something a provider extends, so one class is both the contract and the injection token", async () => {
    const provider: LlmProvider = new FakeProvider();
    expect(provider).toBeInstanceOf(LlmProvider);
    const result = await provider.step(
      {
        feature: "f",
        promptVersion: "v1",
        instructions: "hello",
        messages: [],
        tools: [],
        maxOutputTokens: 10,
      },
      new AbortController().signal,
    );
    expect(result.text).toBe("hello");
  });

  it("names the finish reasons a step can end with", () => {
    expect([...FINISH_REASONS]).toEqual([
      "stop",
      "tool-calls",
      "length",
      "content-filter",
      "other",
    ]);
  });
});
