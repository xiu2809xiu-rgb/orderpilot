import type { AppConfig } from "../../../config/app-config.js";
import type { LlmProvider } from "../domain/llm-provider.js";
import { MockLlmProvider } from "./mock-llm-provider.js";
import type { MockScriptRegistry } from "./mock-scripts.js";

/**
 * Chooses the provider the AI_PROVIDER setting names, once, at start-up. A
 * name whose provider is not built yet stops the API from starting, with a
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
      case "bedrock":
        throw new Error(
          `AI_PROVIDER=${settings.provider} is not available in this build. Set AI_PROVIDER=mock, or leave it unset.`,
        );
    }
  }
}
