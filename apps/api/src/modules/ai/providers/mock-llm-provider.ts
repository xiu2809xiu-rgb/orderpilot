import { AiMockScriptMissingError } from "../domain/ai-errors.js";
import {
  LlmProvider,
  type AiStepRequest,
  type AiStepResult,
  type AiStreamPart,
  type AiToolCall,
  type AiToolResultPart,
  type FinishReason,
} from "../domain/llm-provider.js";
import type {
  MockReply,
  MockScriptContext,
  MockScriptRegistry,
} from "./mock-scripts.js";

// Offline and deterministic. No SDK, no network, no clock, no randomness and no
// environment: it reads nothing but the request and its scripts, so it behaves
// the same with every key absent. Anything that must hold for a real provider
// (the destination check, the fence, retries, the tool loop) is the gateway's
// and is exercised through this class.

export const MOCK_MODEL = "mock-llm-1";

/** A streamed delta is this many characters unless the script chose its own chunks. */
const DEFAULT_CHUNK_CHARACTERS = 16;
/** A page image counts as this many input tokens, whatever its size. */
const IMAGE_TOKENS = 85;

/** About four characters to a token. A fixed function of length, so figures repeat. */
function tokensOf(characters: number): number {
  return Math.ceil(characters / 4);
}

function splitIntoChunks(text: string): string[] {
  const characters = Array.from(text);
  const chunks: string[] = [];
  for (let at = 0; at < characters.length; at += DEFAULT_CHUNK_CHARACTERS) {
    chunks.push(characters.slice(at, at + DEFAULT_CHUNK_CHARACTERS).join(""));
  }
  return chunks;
}

function inputTokensOf(request: AiStepRequest): number {
  let characters = request.instructions.length;
  let images = 0;
  for (const message of request.messages) {
    for (const part of message.parts) {
      switch (part.type) {
        case "text":
          characters += part.text.length;
          break;
        case "image":
          images += 1;
          break;
        case "tool-call":
          characters += part.name.length + JSON.stringify(part.input).length;
          break;
        case "tool-result":
          characters += part.output.length;
          break;
      }
    }
  }
  for (const tool of request.tools) {
    characters +=
      tool.name.length +
      tool.description.length +
      JSON.stringify(tool.inputSchema).length;
  }
  if (request.jsonOutput) {
    characters += JSON.stringify(request.jsonOutput.schema).length;
  }
  return tokensOf(characters) + images * IMAGE_TOKENS;
}

interface Playback {
  readonly chunks: readonly string[];
  readonly toolCalls: readonly AiToolCall[];
  readonly finishReason: FinishReason;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

function playbackOf(
  reply: MockReply,
  turn: number,
  request: AiStepRequest,
): Playback {
  let chunks: readonly string[];
  let toolCalls: readonly AiToolCall[] = [];
  switch (reply.kind) {
    case "text":
      chunks = splitIntoChunks(reply.text);
      break;
    case "chunks":
      chunks = reply.chunks;
      break;
    case "json":
      chunks = splitIntoChunks(JSON.stringify(reply.value));
      break;
    case "tool-calls":
      chunks = splitIntoChunks(reply.text ?? "");
      // Ids repeat for the same script and turn, so a transcript can be compared.
      toolCalls = reply.calls.map((call, index) => ({
        id: `mock-call-${String(turn)}-${String(index)}`,
        name: call.name,
        input: call.input,
      }));
      break;
  }
  let outputCharacters = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  for (const call of toolCalls) {
    outputCharacters += call.name.length + JSON.stringify(call.input).length;
  }
  return {
    chunks,
    toolCalls,
    finishReason: toolCalls.length > 0 ? "tool-calls" : "stop",
    inputTokens: inputTokensOf(request),
    outputTokens: tokensOf(outputCharacters),
  };
}

export class MockLlmProvider extends LlmProvider {
  readonly name = "mock" as const;
  readonly kind = "mock" as const;
  readonly mock = true;

  constructor(
    private readonly scripts: MockScriptRegistry,
    readonly model: string = MOCK_MODEL,
  ) {
    super();
  }

  async step(
    request: AiStepRequest,
    signal: AbortSignal,
  ): Promise<AiStepResult> {
    // Asynchronous like every provider, so a throw below is a rejection.
    await Promise.resolve();
    signal.throwIfAborted();
    const playback = this.play(request);
    return {
      text: playback.chunks.join(""),
      model: this.model,
      toolCalls: playback.toolCalls,
      inputTokens: playback.inputTokens,
      outputTokens: playback.outputTokens,
      finishReason: playback.finishReason,
    };
  }

  async *stream(
    request: AiStepRequest,
    signal: AbortSignal,
  ): AsyncIterable<AiStreamPart> {
    signal.throwIfAborted();
    const playback = this.play(request);
    for (const text of playback.chunks) {
      if (text === "") continue;
      // A tick between parts, so a consumer that stops reading or a signal that
      // fires between chunks is honoured as it would be with a network.
      await Promise.resolve();
      signal.throwIfAborted();
      yield { type: "text-delta", text };
    }
    for (const call of playback.toolCalls) {
      signal.throwIfAborted();
      yield { type: "tool-call", call };
    }
    yield {
      type: "finish",
      model: this.model,
      inputTokens: playback.inputTokens,
      outputTokens: playback.outputTokens,
      finishReason: playback.finishReason,
    };
  }

  private play(request: AiStepRequest): Playback {
    const script = this.scripts.get(request.feature);
    if (!script) throw new AiMockScriptMissingError(request.feature);
    const context = contextOf(request);
    return playbackOf(script(context), context.turn, request);
  }
}

function contextOf(request: AiStepRequest): MockScriptContext {
  const userText: string[] = [];
  const toolResults: AiToolResultPart[] = [];
  let turn = 0;
  for (const message of request.messages) {
    if (message.role === "assistant") turn += 1;
    if (message.role === "tool") toolResults.push(...message.parts);
    if (message.role === "user") {
      for (const part of message.parts) {
        if (part.type === "text") userText.push(part.text);
      }
    }
  }
  return { request, turn, userText: userText.join("\n"), toolResults };
}
