import type { Permission } from "@orderpilot/shared";
import type { AiActor, AiCallContext } from "./ai-call-context.js";
import type { AiCallMeter } from "./ai-call-meter.js";
import {
  AiProviderError,
  AiToolStepsExceededError,
  AiToolsNeedActorError,
} from "./ai-errors.js";
import { jsonSchemaOf } from "./json-schema.js";
import type {
  AiMessage,
  AiStepRequest,
  AiStreamPart,
  AiToolCall,
  AiToolResultPart,
  AiToolSpec,
  FinishReason,
  JsonValue,
  LlmProvider,
} from "./llm-provider.js";
import { describeIssue } from "./output-guard.js";
import type { DataFence } from "./prompt-guard.js";
import type { ReadOnlyTool } from "./read-only-tool.js";

// The bounded loop between a model and its tools. A model can only ASK for a
// tool; whether it runs is decided here, in this order, for every request:
//   1. the name must be one of the tools this call was given;
//   2. the arguments must parse with the tool's own zod schema;
//   3. the asking PERSON's role must hold the tool's permission;
//   4. only then does `execute` run, and its answer goes back fenced as data.
// A "no" at any step is audited and told to the model as an error result, so
// the model can recover; it never throws the whole call away. The loop knows
// nothing of Nest, the database or HTTP: its collaborators are passed in.

/** Asks whether a role holds a permission, as the PERSON the call runs for. */
export interface ToolPermissionRequest {
  readonly actor: AiActor;
  readonly permission: Permission;
  readonly toolName: string;
  readonly traceId: string;
}

export interface ToolPermissionDecision {
  readonly allowed: boolean;
  /** For the audit row only. Never shown to the model or the caller. */
  readonly reason?: string;
}

export type ToolPermissionAsker = (
  request: ToolPermissionRequest,
) => Promise<ToolPermissionDecision>;

export const TOOL_REFUSAL_KINDS = [
  "unknown-tool",
  "invalid-arguments",
  "permission-denied",
  "too-many-calls",
] as const;
export type ToolRefusalKind = (typeof TOOL_REFUSAL_KINDS)[number];

/** What the audit row of a refused tool call is made from. Holds no argument values. */
export interface ToolRefusal {
  readonly kind: ToolRefusalKind;
  /** The name the model sent, cleaned and cut to length: the model chooses it, so it is not trusted. */
  readonly toolName: string;
  /** Null only when the call has no person, and then it has no tool either. */
  readonly actor: AiActor | null;
  /** Set when the tool exists. */
  readonly permission: Permission | null;
  readonly reason: string;
  readonly context: AiCallContext;
}

export type ToolRefusalAuditor = (refusal: ToolRefusal) => Promise<void>;

/** A tool that threw. The class name only: a message may hold data. */
export interface ToolFailure {
  readonly toolName: string;
  readonly errorName: string;
  readonly traceId: string;
}

export interface ToolLoopDeps {
  /** One request at a time. The gateway passes a wrapper that retries a transient failure. */
  readonly provider: Pick<LlmProvider, "step" | "stream">;
  readonly askPermission: ToolPermissionAsker;
  readonly auditRefusal: ToolRefusalAuditor;
  /** The most rounds in which tools may run. A model that wants more is stopped. */
  readonly maxToolSteps: number;
  readonly reportToolFailure?: (failure: ToolFailure) => void;
}

export interface ToolLoopInput {
  /** The request without its messages and tools: the loop adds those each step. */
  readonly request: Omit<AiStepRequest, "messages" | "tools">;
  readonly messages: readonly AiMessage[];
  readonly tools: readonly ReadOnlyTool[];
  readonly context: AiCallContext;
  readonly fence: DataFence;
  readonly meter: AiCallMeter;
  readonly signal: AbortSignal;
}

export type ToolActivityStatus = "ran" | "refused" | "failed";

export type ToolLoopEvent =
  | { readonly type: "text-delta"; readonly text: string }
  | {
      readonly type: "tool-activity";
      readonly id: string;
      readonly name: string;
      readonly status: ToolActivityStatus;
    }
  | {
      readonly type: "done";
      /** The last step's text: the answer. Text said beside a tool call is not it. */
      readonly text: string;
      readonly finishReason: FinishReason;
      /** Everything said so far, so a retry can carry on from it. */
      readonly messages: readonly AiMessage[];
    };

export interface ToolLoopResult {
  readonly text: string;
  readonly finishReason: FinishReason;
  readonly messages: readonly AiMessage[];
}

/** A model that asks for dozens of calls in one breath is stopped at this many. */
const MAX_CALLS_PER_STEP = 8;
/** A tool's answer is cut here, so one greedy tool cannot fill the model's whole prompt. */
const MAX_TOOL_RESULT_CHARACTERS = 20_000;
const MAX_NAME_CHARACTERS = 64;

const TOLD_UNKNOWN = "That tool is not available.";
const TOLD_PERMISSION =
  "The person you are helping is not allowed to use that tool.";
const TOLD_TOO_MANY = "Too many tool calls in one step; this one was not run.";
const TOLD_FAILED = "The tool failed.";

/** The model picks this string, so it is bounded and stripped before it reaches an audit row. */
function cleanName(name: string): string {
  return name.replace(/[^A-Za-z0-9_.-]/g, "?").slice(0, MAX_NAME_CHARACTERS);
}

function errorResult(call: AiToolCall, text: string): AiToolResultPart {
  return {
    type: "tool-result",
    id: call.id,
    name: cleanName(call.name),
    output: text,
    isError: true,
  };
}

function textOf(value: JsonValue | undefined): string {
  const text =
    typeof value === "string" ? value : JSON.stringify(value ?? null);
  return text.length > MAX_TOOL_RESULT_CHARACTERS
    ? `${text.slice(0, MAX_TOOL_RESULT_CHARACTERS)} [cut: the result was too long]`
    : text;
}

interface CallOutcome {
  readonly result: AiToolResultPart;
  readonly status: ToolActivityStatus;
}

export class ToolLoop {
  constructor(private readonly deps: ToolLoopDeps) {
    if (!Number.isInteger(deps.maxToolSteps) || deps.maxToolSteps < 1) {
      throw new RangeError("The tool step cap must be a positive integer.");
    }
  }

  /** Runs to the model's final answer, or throws. */
  async run(input: ToolLoopInput): Promise<ToolLoopResult> {
    const provider = this.deps.provider;
    const asParts = async function* (
      request: AiStepRequest,
    ): AsyncGenerator<AiStreamPart> {
      const step = await provider.step(request, input.signal);
      if (step.text !== "") yield { type: "text-delta", text: step.text };
      for (const call of step.toolCalls) yield { type: "tool-call", call };
      yield {
        type: "finish",
        inputTokens: step.inputTokens,
        outputTokens: step.outputTokens,
        finishReason: step.finishReason,
      };
    };
    for await (const event of this.drive(input, asParts)) {
      if (event.type === "done") {
        return {
          text: event.text,
          finishReason: event.finishReason,
          messages: event.messages,
        };
      }
    }
    // drive always ends with "done" or throws.
    throw new AiProviderError("provider-incomplete");
  }

  /** The same loop over the provider's stream: text as it arrives, what each tool did, then "done". */
  stream(input: ToolLoopInput): AsyncGenerator<ToolLoopEvent> {
    return this.drive(input, (request) =>
      this.deps.provider.stream(request, input.signal),
    );
  }

  private async *drive(
    input: ToolLoopInput,
    obtain: (request: AiStepRequest) => AsyncIterable<AiStreamPart>,
  ): AsyncGenerator<ToolLoopEvent> {
    const { context, signal, meter, tools } = input;
    // A tool runs with the asking person's permissions. With nobody asking
    // there is nothing to run with, so this is a bug found before any request.
    if (tools.length > 0 && context.actor === null) {
      throw new AiToolsNeedActorError();
    }
    const byName = new Map<string, ReadOnlyTool>();
    for (const tool of tools) {
      if (byName.has(tool.name)) {
        throw new RangeError(`Two tools are named "${tool.name}".`);
      }
      byName.set(tool.name, tool);
    }
    const specs: AiToolSpec[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: jsonSchemaOf(tool.inputSchema),
    }));

    const messages: AiMessage[] = [...input.messages];
    for (let round = 0; ; round += 1) {
      signal.throwIfAborted();
      let text = "";
      const calls: AiToolCall[] = [];
      let finishReason: FinishReason | null = null;
      const request: AiStepRequest = {
        ...input.request,
        messages: [...messages],
        tools: specs,
      };
      for await (const part of obtain(request)) {
        if (part.type === "text-delta") {
          text += part.text;
          yield part;
        } else if (part.type === "tool-call") {
          calls.push(part.call);
        } else {
          meter.addTokens(part.inputTokens, part.outputTokens);
          finishReason = part.finishReason;
        }
      }
      // A stream that stops without its final part may have been cut off.
      if (finishReason === null) {
        throw new AiProviderError("provider-incomplete");
      }

      if (calls.length === 0) {
        messages.push({
          role: "assistant",
          parts: text === "" ? [] : [{ type: "text", text }],
        });
        yield { type: "done", text, finishReason, messages };
        return;
      }
      if (round >= this.deps.maxToolSteps) throw new AiToolStepsExceededError();

      messages.push({
        role: "assistant",
        parts: [
          ...(text === "" ? [] : [{ type: "text" as const, text }]),
          ...calls.map((call) => ({ type: "tool-call" as const, ...call })),
        ],
      });
      const results: AiToolResultPart[] = [];
      for (const [index, call] of calls.entries()) {
        const outcome = await this.runCall(
          call,
          index >= MAX_CALLS_PER_STEP,
          byName,
          input,
        );
        results.push(outcome.result);
        yield {
          type: "tool-activity",
          id: call.id,
          name: cleanName(call.name),
          status: outcome.status,
        };
      }
      messages.push({ role: "tool", parts: results });
    }
  }

  private async runCall(
    call: AiToolCall,
    overLimit: boolean,
    byName: ReadonlyMap<string, ReadOnlyTool>,
    input: ToolLoopInput,
  ): Promise<CallOutcome> {
    const { context, signal } = input;
    const actor = context.actor;
    const name = cleanName(call.name);
    const tool = byName.get(call.name);
    const refuse = async (
      kind: ToolRefusalKind,
      reason: string,
      told: string,
    ): Promise<CallOutcome> => {
      await this.deps.auditRefusal({
        kind,
        toolName: name,
        actor,
        permission: tool?.permission ?? null,
        reason,
        context,
      });
      return { result: errorResult(call, told), status: "refused" };
    };

    if (overLimit) {
      return refuse(
        "too-many-calls",
        "more calls than one step may make",
        TOLD_TOO_MANY,
      );
    }
    if (!tool) {
      return refuse(
        "unknown-tool",
        "the tool is not one of this call's tools",
        TOLD_UNKNOWN,
      );
    }
    const parsed = tool.inputSchema.safeParse(call.input);
    if (!parsed.success) {
      const problems = parsed.error.issues
        .slice(0, 5)
        .map(describeIssue)
        .join("; ");
      return refuse(
        "invalid-arguments",
        problems,
        `The arguments did not match the tool's input. ${problems}. Call it again with valid arguments.`,
      );
    }
    // A tool exists only when a person asked, so this cannot happen; it
    // narrows the type and fails closed if it ever does.
    if (actor === null) throw new AiToolsNeedActorError();

    // The asker is given the PERSON's role. The system's own standing is
    // never used: an AI call has no permissions of its own to lend a tool.
    const decision = await this.deps.askPermission({
      actor,
      permission: tool.permission,
      toolName: tool.name,
      traceId: context.traceId,
    });
    if (!decision.allowed) {
      return refuse(
        "permission-denied",
        decision.reason ?? "not-allowed",
        TOLD_PERMISSION,
      );
    }

    try {
      const output = await tool.execute(parsed.data, {
        actor,
        traceId: context.traceId,
        ...(context.documentId === undefined
          ? {}
          : { documentId: context.documentId }),
        signal,
      });
      return {
        result: {
          type: "tool-result",
          id: call.id,
          name,
          output: input.fence.wrap(
            `tool:${tool.name.toLowerCase().slice(0, 50)}`,
            textOf(output),
          ),
          isError: false,
        },
        status: "ran",
      };
    } catch (error) {
      // A cancel or a timeout ends the call; it is not the tool's failure.
      signal.throwIfAborted();
      this.deps.reportToolFailure?.({
        toolName: name,
        errorName: error instanceof Error ? error.name : "NonError",
        traceId: context.traceId,
      });
      return { result: errorResult(call, TOLD_FAILED), status: "failed" };
    }
  }
}
