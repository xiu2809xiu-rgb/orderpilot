import {
  APICallError,
  generateText,
  jsonSchema,
  streamText,
  tool,
  type LanguageModel,
  type ModelMessage,
  type OutputInterface,
  type ToolSet,
} from "ai";
import { AiProviderError } from "../domain/ai-errors.js";
import { reasonOf } from "../domain/ai-runtime.js";
import {
  type AiMessage,
  type AiStepRequest,
  type AiStepResult,
  type AiStreamPart,
  type AiToolCall,
  type FinishReason,
  type JsonSchema,
  type JsonValue,
} from "../domain/llm-provider.js";

// The one place the Vercel AI SDK meets the gateway's port. It turns ONE
// request of the port into ONE SDK call and the answer back into plain data.
// What it does not do is as important: the SDK's own retries are off (ours
// wait and count), no tool has an `execute` (so the SDK returns the model's
// tool calls and runs nothing: the tool loop above decides), and the SDK may
// take one step only. The model's JSON is never parsed or validated here: the
// gateway does that with zod, so every provider answers to the same rule.

/** A model object, never a bare id: a string would route through the SDK's hosted gateway. */
export type SdkModel = Exclude<LanguageModel, string>;

/** How a provider is asked for JSON (the AI_STRUCTURED_OUTPUT setting). */
export type StructuredOutputMode = "json_schema" | "json_object" | "prompt";

export interface TranslatorSettings {
  readonly structuredOutput: StructuredOutputMode;
}

/**
 * The JSON request of a call, as the SDK wants it. A pass-through: the SDK
 * would otherwise parse and validate the text itself and throw its own error
 * for an invalid answer, and a retry with the validation problem fed back is
 * the gateway's job.
 */
function jsonOutputOf(
  name: string,
  schema: JsonSchema | null,
): OutputInterface<string, string, never> {
  return {
    name: "json",
    responseFormat: Promise.resolve(
      schema === null
        ? { type: "json" as const }
        : { type: "json" as const, schema: schema as never, name },
    ),
    parseCompleteOutput: ({ text }) => Promise.resolve(text),
    parsePartialOutput: ({ text }) => Promise.resolve({ partial: text }),
    createElementStreamTransform: () => undefined,
  };
}

function describeSchema(schema: JsonSchema): string {
  return [
    "Answer with one JSON object and nothing else: no prose and no code fence.",
    "It must conform to this JSON Schema:",
    JSON.stringify(schema),
  ].join("\n");
}

function messagesOf(messages: readonly AiMessage[]): ModelMessage[] {
  return messages.map((message): ModelMessage => {
    switch (message.role) {
      case "user":
        return {
          role: "user",
          content: message.parts.map((part) =>
            part.type === "text"
              ? { type: "text" as const, text: part.text }
              : {
                  type: "file" as const,
                  // Tagged, so a string is never read as a URL.
                  data: { type: "data" as const, data: part.dataBase64 },
                  mediaType: part.mediaType,
                },
          ),
        };
      case "assistant":
        return {
          role: "assistant",
          content: message.parts.map((part) =>
            part.type === "text"
              ? { type: "text" as const, text: part.text }
              : {
                  type: "tool-call" as const,
                  toolCallId: part.id,
                  toolName: part.name,
                  input: part.input,
                },
          ),
        };
      case "tool":
        return {
          role: "tool",
          content: message.parts.map((part) => ({
            type: "tool-result" as const,
            toolCallId: part.id,
            toolName: part.name,
            output: {
              type: part.isError ? ("error-text" as const) : ("text" as const),
              value: part.output,
            },
          })),
        };
    }
  });
}

/** Tools with no `execute`: the SDK can only report that the model asked. */
function toolsOf(request: AiStepRequest): ToolSet | undefined {
  if (request.tools.length === 0) return undefined;
  const tools: ToolSet = {};
  for (const spec of request.tools) {
    tools[spec.name] = tool({
      description: spec.description,
      inputSchema: jsonSchema(spec.inputSchema as never),
    });
  }
  return tools;
}

const FINISH_REASON_OF: Readonly<Record<string, FinishReason>> = {
  stop: "stop",
  "tool-calls": "tool-calls",
  length: "length",
  "content-filter": "content-filter",
};

function finishReasonOf(reason: string): FinishReason {
  return FINISH_REASON_OF[reason] ?? "other";
}

/** The name the SDK gives its error for a tool the call did not list. It is not exported as a class. */
const NO_SUCH_TOOL = "AI_NoSuchToolError";

/** What the SDK knows of a tool call. `input` is the parsed JSON, or the raw text when it did not parse. */
interface SdkToolCall {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: unknown;
  readonly invalid?: boolean;
  readonly error?: unknown;
}

/**
 * A call whose arguments are not valid JSON reaches the loop with `null` as
 * its input. No tool's schema accepts null, so the loop answers "invalid
 * arguments" to the model, audits it, and the model can try again: one broken
 * call does not throw the whole answer away. An unknown tool name is passed on
 * as it came, because the loop refuses a name by itself and audits that.
 */
function toolCallOf(call: SdkToolCall): AiToolCall {
  const unparseable =
    call.invalid === true &&
    typeof call.input === "string" &&
    !(call.error instanceof Error && call.error.name === NO_SUCH_TOOL);
  return {
    id: call.toolCallId,
    name: call.toolName,
    input: unparseable ? null : (call.input as JsonValue),
  };
}

/** A retry-after header: a number of seconds, or an HTTP date. Null when absent or not understood. */
export function retryAfterMsOf(
  value: string | undefined,
  nowMs: number,
): number | null {
  if (value === undefined) return null;
  const text = value.trim();
  if (text === "") return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 1000);
  const date = Date.parse(text);
  return Number.isNaN(date) ? null : Math.max(0, date - nowMs);
}

function headerOf(
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined {
  if (headers === undefined) return undefined;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/**
 * The gateway's error for whatever the SDK threw. Only a status, a retry-after
 * hint and a short code survive: the SDK's error holds the response body, the
 * request body and the URL, and none of them may travel on. An abort is passed
 * on untouched, because ProviderRequests knows whether it was its own timeout.
 */
export function mapSdkError(
  error: unknown,
  signal: AbortSignal,
  nowMs: number = Date.now(),
): unknown {
  if (signal.aborted || isAbort(error)) return error;
  if (error instanceof AiProviderError) return error;
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === undefined) return AiProviderError.network();
    // A 2xx whose body could not be read is the SDK's error too: it is not an HTTP failure.
    if (status < 400) return AiProviderError.badResponse();
    return AiProviderError.fromHttpStatus(
      status,
      retryAfterMsOf(headerOf(error.responseHeaders, "retry-after"), nowMs),
    );
  }
  return AiProviderError.badResponse();
}

export class AiSdkTranslator {
  constructor(private readonly settings: TranslatorSettings) {}

  /** Whether the model must be told the schema in words, because the request carries none. */
  private instructionsOf(request: AiStepRequest): string {
    if (
      request.jsonOutput !== undefined &&
      this.settings.structuredOutput !== "json_schema"
    ) {
      return `${request.instructions}\n\n${describeSchema(request.jsonOutput.schema)}`;
    }
    return request.instructions;
  }

  private outputOf(
    request: AiStepRequest,
  ): OutputInterface<string, string, never> | undefined {
    if (request.jsonOutput === undefined) return undefined;
    switch (this.settings.structuredOutput) {
      case "json_schema":
        return jsonOutputOf(request.jsonOutput.name, request.jsonOutput.schema);
      case "json_object":
        return jsonOutputOf(request.jsonOutput.name, null);
      case "prompt":
        return undefined;
    }
  }

  private optionsOf(
    model: SdkModel,
    request: AiStepRequest,
    signal: AbortSignal,
  ) {
    const output = this.outputOf(request);
    const tools = toolsOf(request);
    return {
      model,
      instructions: this.instructionsOf(request),
      messages: messagesOf(request.messages),
      maxOutputTokens: request.maxOutputTokens,
      abortSignal: signal,
      // Ours retry, wait and count. A second layer would multiply the attempts.
      maxRetries: 0,
      ...(output === undefined ? {} : { output }),
      ...(tools === undefined ? {} : { tools }),
    };
  }

  async step(
    model: SdkModel,
    request: AiStepRequest,
    signal: AbortSignal,
  ): Promise<AiStepResult> {
    try {
      const result = await generateText(this.optionsOf(model, request, signal));
      return {
        text: result.text,
        toolCalls: result.toolCalls.map((call) => toolCallOf(call)),
        inputTokens: result.usage.inputTokens ?? 0,
        outputTokens: result.usage.outputTokens ?? 0,
        finishReason: finishReasonOf(result.finishReason),
      };
    } catch (error) {
      throw mapSdkError(error, signal);
    }
  }

  async *stream(
    model: SdkModel,
    request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncGenerator<AiStreamPart> {
    let finished = false;
    try {
      const result = streamText({
        ...this.optionsOf(model, request, signal),
        // The default handler prints the error object, and that holds the response body.
        onError: () => undefined,
      });
      for await (const part of result.stream) {
        switch (part.type) {
          case "text-delta":
            yield { type: "text-delta", text: part.text };
            break;
          case "tool-call":
            yield { type: "tool-call", call: toolCallOf(part) };
            break;
          case "finish":
            finished = true;
            yield {
              type: "finish",
              inputTokens: part.totalUsage.inputTokens ?? 0,
              outputTokens: part.totalUsage.outputTokens ?? 0,
              finishReason: finishReasonOf(part.finishReason),
            };
            break;
          case "error":
            throw part.error;
          case "abort":
            throw reasonOf(signal);
          default:
            break;
        }
      }
      // A stream that ends without its last part was cut short, not finished.
      if (!finished) throw AiProviderError.badResponse();
    } catch (error) {
      throw mapSdkError(error, signal);
    }
  }
}
