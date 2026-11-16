import type { AiProvider, AiProviderSetting } from "@orderpilot/shared";

// The port under LlmGateway: ONE model request, in plain data. No zod type and
// no SDK type crosses it, so the mock and a real provider are interchangeable
// and a change of SDK touches the adapters only. Retries, the tool loop, the
// destination check and usage tracking all live above this line.

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** A JSON Schema object. The gateway makes it from a zod schema; a provider only forwards it. */
export type JsonSchema = Readonly<Record<string, JsonValue>>;

export interface AiTextPart {
  readonly type: "text";
  readonly text: string;
}

/** A page image. Data like any document: the instructions say so. */
export interface AiImagePart {
  readonly type: "image";
  readonly mediaType: "image/png" | "image/jpeg";
  readonly dataBase64: string;
}

/** What the model asked for. `input` is what it sent, parsed as JSON but not yet trusted. */
export interface AiToolCall {
  readonly id: string;
  readonly name: string;
  readonly input: JsonValue;
}

export interface AiToolCallPart extends AiToolCall {
  readonly type: "tool-call";
}

/** What a tool answered, already fenced as data by the loop. An error is told to the model, not thrown. */
export interface AiToolResultPart {
  readonly type: "tool-result";
  readonly id: string;
  readonly name: string;
  readonly output: string;
  readonly isError: boolean;
}

export interface AiUserMessage {
  readonly role: "user";
  readonly parts: readonly (AiTextPart | AiImagePart)[];
}

export interface AiAssistantMessage {
  readonly role: "assistant";
  readonly parts: readonly (AiTextPart | AiToolCallPart)[];
}

export interface AiToolMessage {
  readonly role: "tool";
  readonly parts: readonly AiToolResultPart[];
}

export type AiMessage = AiUserMessage | AiAssistantMessage | AiToolMessage;

/** A tool as the model sees it. Whether it may run is decided above the port, never here. */
export interface AiToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}

/** Ask for a JSON answer. How hard to ask (strict schema, JSON mode or words only) is the provider's setting. */
export interface AiJsonOutputRequest {
  readonly name: string;
  readonly schema: JsonSchema;
}

export interface AiStepRequest {
  /** Routes the mock's script and labels nothing else: a real provider ignores it. */
  readonly feature: string;
  readonly promptVersion: string;
  /** Trusted text only. Documents never go here: they are fenced inside a message. */
  readonly instructions: string;
  readonly messages: readonly AiMessage[];
  readonly tools: readonly AiToolSpec[];
  readonly jsonOutput?: AiJsonOutputRequest;
  readonly maxOutputTokens: number;
}

export const FINISH_REASONS = [
  "stop",
  "tool-calls",
  "length",
  "content-filter",
  "other",
] as const;
export type FinishReason = (typeof FINISH_REASONS)[number];

export interface AiStepResult {
  readonly text: string;
  /** The model that answered: a request with page images may go to another model than the text one. */
  readonly model: string;
  readonly toolCalls: readonly AiToolCall[];
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly finishReason: FinishReason;
}

export type AiStreamPart =
  | { readonly type: "text-delta"; readonly text: string }
  | { readonly type: "tool-call"; readonly call: AiToolCall }
  | {
      readonly type: "finish";
      readonly model: string;
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly finishReason: FinishReason;
    };

/**
 * One model, reached one request at a time. An abstract class rather than an
 * interface so it can be the injection token too.
 *
 * A provider throws AiProviderError for anything the model's side did wrong,
 * and never puts a response body, a key or a prompt in it. It honours the
 * signal: the gateway's timeout and a caller's cancel both arrive there.
 */
export abstract class LlmProvider {
  /** The AI_PROVIDER setting. It is what the usage record stores. */
  abstract readonly name: AiProviderSetting;
  /** What area 4's destination policy is asked about. */
  abstract readonly kind: AiProvider;
  abstract readonly model: string;
  /** True when the answers are scripted. The web app shows "Mock AI" from it. */
  abstract readonly mock: boolean;

  abstract step(
    request: AiStepRequest,
    signal: AbortSignal,
  ): Promise<AiStepResult>;

  abstract stream(
    request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncIterable<AiStreamPart>;
}
