import { describe, expect, it } from "vitest";
import { baseEnv } from "../../../../test/support/base-env.js";
import { AppConfig } from "../../../config/app-config.js";
import { BedrockLlmProvider } from "./bedrock-llm-provider.js";
import { MockLlmProvider } from "./mock-llm-provider.js";
import { MockScriptRegistry } from "./mock-scripts.js";
import { OpenAiCompatibleLlmProvider } from "./openai-compatible-llm-provider.js";
import { LlmProviderFactory } from "./provider-factory.js";

const base = baseEnv();

function build(extra: NodeJS.ProcessEnv) {
  const config = AppConfig.fromEnv({ ...base, ...extra });
  return new LlmProviderFactory().create(config.ai, new MockScriptRegistry());
}

describe("the provider factory", () => {
  it("builds the mock, which is the default", () => {
    const provider = build({});
    expect(provider).toBeInstanceOf(MockLlmProvider);
    expect(provider).toMatchObject({ name: "mock", kind: "mock", mock: true });
  });

  it.each([
    ["gemini", { GEMINI_API_KEY: "k", AI_MODEL: "m" }],
    ["groq", { GROQ_API_KEY: "k", AI_MODEL: "m" }],
    [
      "openai-compatible",
      { AI_BASE_URL: "http://localhost:11434/v1", AI_MODEL: "m" },
    ],
  ])(
    "builds the OpenAI-compatible provider for %s, under its own name",
    (name, extra) => {
      const provider = build({ AI_PROVIDER: name, ...extra });
      expect(provider).toBeInstanceOf(OpenAiCompatibleLlmProvider);
      expect(provider).toMatchObject({
        name,
        kind: "openai-compatible",
        model: "m",
        mock: false,
      });
    },
  );

  it("builds the Bedrock provider", () => {
    const provider = build({
      AI_PROVIDER: "bedrock",
      AI_MODEL: "m",
      AI_BEDROCK_REGION: "ap-southeast-1",
      AI_BEDROCK_ACCESS_KEY_ID: "id",
      AI_BEDROCK_SECRET_ACCESS_KEY: "secret",
    });
    expect(provider).toBeInstanceOf(BedrockLlmProvider);
    expect(provider).toMatchObject({
      name: "bedrock",
      kind: "bedrock",
      model: "m",
      mock: false,
    });
  });

  it.each([
    ["gemini", { GEMINI_API_KEY: "k" }, "AI_MODEL"],
    ["groq", { AI_MODEL: "m" }, "GROQ_API_KEY"],
    ["openai-compatible", { AI_MODEL: "m" }, "AI_BASE_URL"],
    [
      "bedrock",
      { AI_MODEL: "m", AI_BEDROCK_REGION: "ap-southeast-1" },
      "AI_BEDROCK_ACCESS_KEY_ID",
    ],
  ])(
    "stops start-up for %s when a setting is missing, naming the setting and no value",
    (name, extra, missing) => {
      const attempt = () => build({ AI_PROVIDER: name, ...extra });
      expect(attempt).toThrow(missing);
      expect(attempt).not.toThrow(/\bk\b/);
    },
  );
});
