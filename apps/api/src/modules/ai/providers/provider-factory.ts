import type { AppConfig } from "../../../config/app-config.js";
import type { LlmProvider } from "../domain/llm-provider.js";
import { BedrockLlmProvider } from "./bedrock-llm-provider.js";
import { MockLlmProvider } from "./mock-llm-provider.js";
import type { MockScriptRegistry } from "./mock-scripts.js";
import { OpenAiCompatibleLlmProvider } from "./openai-compatible-llm-provider.js";

/**
 * Chooses the provider the AI_PROVIDER setting names, once, at start-up. A
 * provider whose settings are incomplete stops the API from starting, with a
 * message that names the setting, instead of quietly answering from the mock:
 * a screen that says "Groq" must never be showing scripted text.
 */
export class LlmProviderFactory {
  create(settings: AppConfig["ai"], scripts: MockScriptRegistry): LlmProvider {
    switch (settings.provider) {
      case "mock":
        return new MockLlmProvider(scripts);
      case "gemini":
      case "groq":
      case "openai-compatible":
        return new OpenAiCompatibleLlmProvider(settings);
      case "bedrock":
        return new BedrockLlmProvider(settings);
    }
  }
}
