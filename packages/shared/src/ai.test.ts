import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_SETTINGS,
  aiProbeInputSchema,
  aiProbeResponseSchema,
  aiProviderSettingSchema,
  aiStatusResponseSchema,
  aiStatusSchema,
} from "./index.js";

const status = {
  provider: "mock",
  kind: "mock",
  model: "mock-llm-1",
  mock: true,
} as const;

const probe = {
  provider: "groq",
  kind: "openai-compatible",
  model: "synthetic-model",
  mock: false,
  outcome: "error",
  reasonCode: "provider-http-429",
  latencyMs: 412,
  inputTokens: 18,
  outputTokens: 0,
  attempts: 1,
} as const;

describe("the AI provider setting", () => {
  it("names the five values of AI_PROVIDER", () => {
    expect([...AI_PROVIDER_SETTINGS]).toEqual([
      "mock",
      "gemini",
      "groq",
      "openai-compatible",
      "bedrock",
    ]);
  });

  it("refuses a name nobody planned", () => {
    expect(aiProviderSettingSchema.safeParse("anthropic").success).toBe(false);
  });
});

describe("the AI status", () => {
  it("accepts a status and wraps it in an envelope", () => {
    expect(aiStatusSchema.safeParse(status).success).toBe(true);
    expect(aiStatusResponseSchema.safeParse({ data: status }).success).toBe(
      true,
    );
  });

  it("takes the kind of the data-to-AI policy, not a setting name", () => {
    expect(aiStatusSchema.safeParse({ ...status, kind: "groq" }).success).toBe(
      false,
    );
  });

  it("refuses an empty model", () => {
    expect(aiStatusSchema.safeParse({ ...status, model: "" }).success).toBe(
      false,
    );
  });
});

describe("the AI probe", () => {
  it("takes the two modes and nothing else", () => {
    expect(aiProbeInputSchema.safeParse({ mode: "text" }).success).toBe(true);
    expect(aiProbeInputSchema.safeParse({ mode: "structured" }).success).toBe(
      true,
    );
    expect(aiProbeInputSchema.safeParse({ mode: "vision" }).success).toBe(
      false,
    );
    expect(aiProbeInputSchema.safeParse({}).success).toBe(false);
  });

  it("refuses free text, which would turn the probe into a relay", () => {
    expect(
      aiProbeInputSchema.safeParse({ mode: "text", prompt: "hello" }).success,
    ).toBe(false);
  });

  it("accepts a failed call as a result, with a code and no message", () => {
    expect(aiProbeResponseSchema.safeParse({ data: probe }).success).toBe(true);
    expect(
      aiProbeResponseSchema.safeParse({
        data: { ...probe, outcome: "ok", reasonCode: null },
      }).success,
    ).toBe(true);
  });

  it("takes null token and attempt figures for a call that did not succeed", () => {
    expect(
      aiProbeResponseSchema.safeParse({
        data: {
          ...probe,
          outcome: "error",
          reasonCode: "provider-http-401",
          inputTokens: null,
          outputTokens: null,
          attempts: null,
        },
      }).success,
    ).toBe(true);
  });

  it("refuses an outcome outside the usage statuses", () => {
    expect(
      aiProbeResponseSchema.safeParse({ data: { ...probe, outcome: "failed" } })
        .success,
    ).toBe(false);
  });

  it("refuses negative figures", () => {
    expect(
      aiProbeResponseSchema.safeParse({ data: { ...probe, latencyMs: -1 } })
        .success,
    ).toBe(false);
  });
});
