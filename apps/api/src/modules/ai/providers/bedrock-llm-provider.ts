import type * as BedrockModule from "@ai-sdk/amazon-bedrock";
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

// Amazon Bedrock, through the SDK's own provider. The package is a dynamic
// import() made on first use, so an installation that never chooses Bedrock
// never loads it, and its AWS code never runs. NOT TESTED AGAINST AWS: nothing
// here has reached a real Bedrock endpoint. See the report of story P-17.

type Settings = AppConfig["ai"];
type BedrockCredentials = NonNullable<Settings["bedrock"]>;
type BedrockSdk = typeof BedrockModule;

export interface BedrockOptions {
  /** For a test that must see the request without AWS. Production never sets it. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * The runtime endpoint of a region. The SDK would read AWS_ENDPOINT_URL from
 * the environment when it is not given one, and requests are signed with our
 * keys, so the endpoint is always named here and never left to the process.
 */
export function bedrockBaseUrlOf(region: string): string {
  const suffix = region.startsWith("cn-")
    ? "amazonaws.com.cn"
    : "amazonaws.com";
  return `https://bedrock-runtime.${region}.${suffix}`;
}

export class BedrockLlmProvider extends LlmProvider {
  readonly name: AiProviderSetting = "bedrock";
  readonly kind: AiProvider = "bedrock";
  readonly model: string;
  readonly mock = false;

  private readonly visionModel: string;
  private readonly imageCap: number;
  private readonly credentials: BedrockCredentials;
  private readonly translator: AiSdkTranslator;
  private readonly fetchOverride: typeof globalThis.fetch | undefined;
  private chat: Promise<(modelId: string) => SdkModel> | null = null;

  constructor(settings: Settings, options: BedrockOptions = {}) {
    super();
    if (settings.provider !== "bedrock") {
      throw new Error(
        `AI_PROVIDER=${settings.provider} is not the Bedrock provider.`,
      );
    }
    if (settings.bedrock === null) {
      throw new Error(
        "AI_BEDROCK_REGION, AI_BEDROCK_ACCESS_KEY_ID and AI_BEDROCK_SECRET_ACCESS_KEY are needed. Set them in the root .env.",
      );
    }
    if (settings.model === null) {
      throw new Error("AI_MODEL is needed. Set it in the root .env.");
    }
    this.credentials = settings.bedrock;
    this.model = settings.model;
    this.visionModel = settings.visionModel ?? settings.model;
    this.imageCap = settings.maxImagesPerRequest;
    this.fetchOverride = options.fetch;
    // Bedrock has no JSON mode. The strict schema goes through the SDK; the
    // other two settings ask in words, and zod checks the answer either way.
    this.translator = new AiSdkTranslator({
      structuredOutput:
        settings.structuredOutput === "json_schema" ? "json_schema" : "prompt",
    });
  }

  step(request: AiStepRequest, signal: AbortSignal): Promise<AiStepResult> {
    return this.modelFor(request).then((model) =>
      this.translator.step(model, request, signal),
    );
  }

  async *stream(
    request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncGenerator<AiStreamPart> {
    const model = await this.modelFor(request);
    yield* this.translator.stream(model, request, signal);
  }

  private async modelFor(request: AiStepRequest): Promise<SdkModel> {
    let images = 0;
    for (const message of request.messages) {
      for (const part of message.parts) {
        if (part.type === "image") images += 1;
      }
    }
    if (images > this.imageCap) throw new AiImageLimitError(this.imageCap);
    this.chat ??= this.load();
    const chat = await this.chat;
    return chat(images > 0 ? this.visionModel : this.model);
  }

  private async load(): Promise<(modelId: string) => SdkModel> {
    let sdk: BedrockSdk;
    try {
      sdk = await import("@ai-sdk/amazon-bedrock");
    } catch (error) {
      // A failed load is tried again on the next request.
      this.chat = null;
      throw error;
    }
    const provider = sdk.createAmazonBedrock({
      region: this.credentials.region,
      baseURL: bedrockBaseUrlOf(this.credentials.region),
      accessKeyId: this.credentials.accessKeyId,
      secretAccessKey: this.credentials.secretAccessKey,
      // Null must read as "none", not as "look in the environment".
      sessionToken: this.credentials.sessionToken ?? undefined,
      // An empty key is "no key", so AWS_BEARER_TOKEN_BEDROCK is never read.
      apiKey: "",
      ...(this.fetchOverride === undefined
        ? {}
        : { fetch: this.fetchOverride }),
    });
    return (modelId) => provider.languageModel(modelId);
  }
}
