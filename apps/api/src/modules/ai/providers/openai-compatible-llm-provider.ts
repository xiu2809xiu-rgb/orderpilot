import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { AiProvider, AiProviderSetting } from "@orderpilot/shared";
import type { AppConfig } from "../../../config/app-config.js";
import { AiImageLimitError } from "../domain/ai-errors.js";
import {
  LlmProvider,
  type AiStepRequest,
  type AiStepResult,
  type AiStreamPart,
} from "../domain/llm-provider.js";
import { AiSdkTranslator, type SdkModel } from "./ai-sdk-translator.js";

// Anything that speaks the chat completions API: Gemini and Groq through their
// compatible endpoints, or a local server. Gemini and Groq are presets, which
// means only that their base URL is known here; the key and the model still
// come from the settings, because model ids change faster than this code does.

/** The base URL of each preset. Checked against the vendors' documentation on 15 Nov 2026. */
export const PRESET_BASE_URLS = {
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  groq: "https://api.groq.com/openai/v1",
} as const;

type OpenAiCompatibleName = "gemini" | "groq" | "openai-compatible";
type Settings = AppConfig["ai"];

export interface OpenAiCompatibleOptions {
  /** For a test that must see the request without a network. Production never sets it. */
  readonly fetch?: typeof globalThis.fetch;
}

/** The name the SDK files its provider options under. Nothing is sent in them. */
const SDK_PROVIDER_NAME = "openai-compatible";

function isOpenAiCompatibleName(
  name: AiProviderSetting,
): name is OpenAiCompatibleName {
  return name === "gemini" || name === "groq" || name === "openai-compatible";
}

function baseUrlOf(settings: Settings): string {
  const name = settings.provider;
  if (name === "gemini" || name === "groq") return PRESET_BASE_URLS[name];
  if (settings.baseUrl === null) {
    throw new Error(
      "AI_BASE_URL is needed for AI_PROVIDER=openai-compatible. Set it in the root .env.",
    );
  }
  return settings.baseUrl;
}

export class OpenAiCompatibleLlmProvider extends LlmProvider {
  readonly name: AiProviderSetting;
  readonly kind: AiProvider = "openai-compatible";
  readonly model: string;
  readonly mock = false;

  private readonly visionModel: string;
  private readonly imageCap: number;
  private readonly translator: AiSdkTranslator;
  private readonly chat: (modelId: string) => SdkModel;

  constructor(settings: Settings, options: OpenAiCompatibleOptions = {}) {
    super();
    if (!isOpenAiCompatibleName(settings.provider)) {
      throw new Error(
        `AI_PROVIDER=${settings.provider} is not an OpenAI-compatible provider.`,
      );
    }
    if (settings.model === null) {
      throw new Error("AI_MODEL is needed. Set it in the root .env.");
    }
    this.name = settings.provider;
    this.model = settings.model;
    this.visionModel = settings.visionModel ?? settings.model;
    this.imageCap = settings.maxImagesPerRequest;
    this.translator = new AiSdkTranslator({
      structuredOutput: settings.structuredOutput,
    });
    const provider = createOpenAICompatible({
      name: SDK_PROVIDER_NAME,
      baseURL: baseUrlOf(settings),
      // A local server may have none. No key means no Authorization header.
      ...(settings.apiKey === null ? {} : { apiKey: settings.apiKey }),
      // Without this a stream carries no token counts, and the cost would read zero.
      includeUsage: true,
      supportsStructuredOutputs: settings.structuredOutput === "json_schema",
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    });
    this.chat = (modelId) => provider.chatModel(modelId);
  }

  async step(
    request: AiStepRequest,
    signal: AbortSignal,
  ): Promise<AiStepResult> {
    return await this.translator.step(this.modelFor(request), request, signal);
  }

  async *stream(
    request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncGenerator<AiStreamPart> {
    yield* this.translator.stream(this.modelFor(request), request, signal);
  }

  /** Pages go to the vision model, which falls back to the text model. More images than the cap never leave. */
  private modelFor(request: AiStepRequest): SdkModel {
    let images = 0;
    for (const message of request.messages) {
      for (const part of message.parts) {
        if (part.type === "image") images += 1;
      }
    }
    if (images > this.imageCap) throw new AiImageLimitError(this.imageCap);
    return this.chat(images > 0 ? this.visionModel : this.model);
  }
}
