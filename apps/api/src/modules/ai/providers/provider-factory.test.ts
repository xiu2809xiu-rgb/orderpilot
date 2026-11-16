import { describe, expect, it } from "vitest";
import { baseEnv } from "../../../../test/support/base-env.js";
import { AppConfig } from "../../../config/app-config.js";
import { MockLlmProvider } from "./mock-llm-provider.js";
import { MockScriptRegistry } from "./mock-scripts.js";
import { LlmProviderFactory } from "./provider-factory.js";

const base = baseEnv();

describe("the provider factory", () => {
  it("builds the mock, which is the default", () => {
    const config = AppConfig.fromEnv(base);
    const provider = new LlmProviderFactory().create(
      config.ai,
      new MockScriptRegistry(),
    );
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
    "stops start-up for %s, with a message that names the setting and no key",
    (name, extra) => {
      const config = AppConfig.fromEnv({
        ...base,
        AI_PROVIDER: name,
        ...extra,
      });
      const attempt = () =>
        new LlmProviderFactory().create(config.ai, new MockScriptRegistry());
      expect(attempt).toThrow(`AI_PROVIDER=${name}`);
      expect(attempt).not.toThrow(/\bk\b/);
    },
  );
});
