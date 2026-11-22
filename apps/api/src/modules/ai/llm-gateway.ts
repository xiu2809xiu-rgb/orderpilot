import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AiDestinationDecision } from "@orderpilot/shared";
import type { z } from "zod";
import { DomainError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { AiCallScope, type AiCallUsage } from "./ai-call-scope.js";
import { AiDestinationPolicy } from "./ai-destination.policy.js";
import { AiRefusalAuditor } from "./ai-refusal.auditor.js";
import { AiToolPermissionAsker } from "./ai-tool-permission.asker.js";
import { AiUsageTracker } from "./ai-usage.tracker.js";
import type { AiCallContext } from "./domain/ai-call-context.js";
import {
  AiCallInTransactionError,
  AiDestinationRefusedError,
  AiImageLimitError,
  AiInvalidOutputError,
  AiProviderError,
  AiToolsNeedActorError,
  outcomeOfError,
} from "./domain/ai-errors.js";
import type { AiRuntime } from "./domain/ai-runtime.js";
import { jsonSchemaOf } from "./domain/json-schema.js";
import {
  LlmProvider,
  type AiImagePart,
  type AiMessage,
  type AiStepRequest,
  type AiTextPart,
  type FinishReason,
} from "./domain/llm-provider.js";
import { OutputGuard } from "./domain/output-guard.js";
import { PromptGuard, type DataFence } from "./domain/prompt-guard.js";
import { ProviderRequests } from "./domain/provider-requests.js";
import type { ReadOnlyTool } from "./domain/read-only-tool.js";
import { RetryPolicy } from "./domain/retry-policy.js";
import {
  ToolLoop,
  type ToolActivityStatus,
  type ToolLoopInput,
} from "./domain/tool-loop.js";

// The only way a feature reaches a model. In order, for every call and every
// provider (the mock too): refuse inside a database transaction; ask the
// destination policy; fence the documents; run the bounded tool loop; check the
// answer; write the usage record; return. A feature gets text or a validated
// object back and nothing it could use to act: no write, approval, payment,
// posting or message goes through here, and the model is never given one.

/** Injection tokens for the two plain-data collaborators of the gateway. */
export const AI_GATEWAY_LIMITS = "AI_GATEWAY_LIMITS";
export const AI_RUNTIME = "AI_RUNTIME";

export interface AiGatewayLimits {
  /**
   * Caps the tries of one provider request and, separately, the rounds of
   * asking again for an invalid answer.
   */
  readonly maxAttempts: number;
  readonly maxToolSteps: number;
  readonly maxImagesPerRequest: number;
  readonly maxOutputTokens: number;
  /** A plain request's whole time, or a stream's longest silence. */
  readonly timeoutMs: number;
}

/** A document the model may read. Untrusted: it is fenced and the model is told it is data. */
export interface AiDocument {
  /** What it is, for the fence: lower case letters, digits and . _ : - ("document:po"). */
  readonly label: string;
  readonly text: string;
}

/** A turn of the conversation: a person's own words, or the model's earlier answer. */
export interface AiInputMessage {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface AiCallInput {
  /** Trusted text of ours. A document never goes here. */
  readonly instructions: string;
  readonly messages?: readonly AiInputMessage[];
  readonly documents?: readonly AiDocument[];
  readonly images?: readonly AiImagePart[];
  /** The tools this ONE call may use. A call with no person behind it may not have any. */
  readonly tools?: readonly ReadOnlyTool[];
}

export interface AiObjectInput<T> extends AiCallInput {
  /** The answer is parsed by this. Keys it does not name are dropped. */
  readonly schema: z.ZodType<T>;
}

/** Every public result says whether the answer was scripted. */
export interface AiTextResult {
  readonly text: string;
  readonly finishReason: FinishReason;
  readonly usage: AiCallUsage;
  readonly mock: boolean;
}

export interface AiObjectResult<T> {
  readonly object: T;
  /** Answers asked for: 1 when the first was valid. */
  readonly attempts: number;
  readonly usage: AiCallUsage;
  readonly mock: boolean;
}

export type AiStreamEvent =
  | { readonly type: "text-delta"; readonly text: string }
  | {
      readonly type: "tool-activity";
      readonly id: string;
      readonly name: string;
      readonly status: ToolActivityStatus;
    }
  | {
      readonly type: "final";
      readonly text: string;
      readonly finishReason: FinishReason;
      readonly usage: AiCallUsage;
      readonly mock: boolean;
    };

/** What a caller is told of a failure: our own errors, and nothing of the content of any other. */
function publicError(error: unknown): Error {
  if (error instanceof DomainError || error instanceof RangeError) {
    return error;
  }
  return new AiProviderError("internal");
}

/** About four characters to a token, doubled: an answer longer than this is not one. */
const OUTPUT_CHARACTERS_PER_TOKEN = 8;

interface PreparedCall {
  readonly loop: ToolLoop;
  readonly loopInput: ToolLoopInput;
}

@Injectable()
export class LlmGateway {
  private readonly logger = new Logger(LlmGateway.name);
  private readonly retry = new RetryPolicy();
  private readonly outputGuard: OutputGuard;

  constructor(
    @Inject(LlmProvider) private readonly provider: LlmProvider,
    @Inject(AiDestinationPolicy)
    private readonly destination: AiDestinationPolicy,
    @Inject(AiUsageTracker)
    private readonly usageSink: Pick<AiUsageTracker, "record">,
    @Inject(AiRefusalAuditor)
    private readonly auditor: Pick<
      AiRefusalAuditor,
      "destinationRefused" | "toolRefused"
    >,
    @Inject(AiToolPermissionAsker)
    private readonly permissions: Pick<AiToolPermissionAsker, "ask">,
    @Inject(Database)
    private readonly database: Pick<Database, "inTransaction">,
    @Inject(PromptGuard) private readonly promptGuard: PromptGuard,
    @Inject(AI_GATEWAY_LIMITS) private readonly limits: AiGatewayLimits,
    @Inject(AI_RUNTIME) private readonly runtime: AiRuntime,
  ) {
    this.outputGuard = new OutputGuard(
      limits.maxOutputTokens * OUTPUT_CHARACTERS_PER_TOKEN,
    );
  }

  async generateText(
    context: AiCallContext,
    input: AiCallInput,
  ): Promise<AiTextResult> {
    this.refuseInTransaction();
    const scope = this.openScope(context);
    const controller = new AbortController();
    try {
      const call = await this.prepare(context, input, scope, controller.signal);
      const answer = await call.loop.run(call.loopInput);
      await scope.record("ok", null);
      return {
        text: answer.text,
        finishReason: answer.finishReason,
        usage: scope.usage(),
        mock: this.provider.mock,
      };
    } catch (error) {
      throw await this.failed(scope, context, error);
    }
  }

  async generateObject<T>(
    context: AiCallContext,
    input: AiObjectInput<T>,
  ): Promise<AiObjectResult<T>> {
    this.refuseInTransaction();
    const scope = this.openScope(context);
    const controller = new AbortController();
    try {
      const call = await this.prepare(
        context,
        input,
        scope,
        controller.signal,
        { name: context.feature, schema: jsonSchemaOf(input.schema) },
      );
      const { object, attempts } = await this.answerInShape(
        call,
        input.schema,
        scope,
      );
      await scope.record("ok", null);
      return {
        object,
        attempts,
        usage: scope.usage(),
        mock: this.provider.mock,
      };
    } catch (error) {
      throw await this.failed(scope, context, error);
    }
  }

  /**
   * Text as it arrives, then what each tool did, then one final part with the
   * whole answer and the usage. The refusal inside a transaction is thrown
   * here, before an iterator exists; every other refusal and failure is thrown
   * when the consumer reads. A consumer that stops early still leaves exactly
   * one usage record, and the request in flight is cancelled.
   */
  streamText(
    context: AiCallContext,
    input: AiCallInput,
  ): AsyncGenerator<AiStreamEvent> {
    this.refuseInTransaction();
    return this.streaming(context, input);
  }

  private async *streaming(
    context: AiCallContext,
    input: AiCallInput,
  ): AsyncGenerator<AiStreamEvent> {
    const scope = this.openScope(context);
    const controller = new AbortController();
    try {
      const call = await this.prepare(context, input, scope, controller.signal);
      for await (const event of call.loop.stream(call.loopInput)) {
        if (event.type !== "done") {
          yield event;
          continue;
        }
        // Written before the last part is handed over: a consumer that stops
        // right there must not leave the call unrecorded.
        await scope.record("ok", null);
        yield {
          type: "final",
          text: event.text,
          finishReason: event.finishReason,
          usage: scope.usage(),
          mock: this.provider.mock,
        };
      }
    } catch (error) {
      throw await this.failed(scope, context, error);
    } finally {
      controller.abort();
      // Reached with nothing recorded only when the consumer stopped reading.
      await scope.record("error", "cancelled");
    }
  }

  private refuseInTransaction(): void {
    // No usage record: it would join the transaction and be rolled back with it.
    if (this.database.inTransaction) throw new AiCallInTransactionError();
  }

  private openScope(context: AiCallContext): AiCallScope {
    return new AiCallScope(
      context,
      this.provider,
      this.usageSink,
      this.runtime,
    );
  }

  /** Records how the call failed, once, and returns what the caller may see. */
  private async failed(
    scope: AiCallScope,
    context: AiCallContext,
    error: unknown,
  ): Promise<Error> {
    const { outcome, reasonCode } = outcomeOfError(error);
    if (reasonCode === "internal") {
      // The class only: a message may quote the document or a response.
      this.logger.error(
        {
          traceId: context.traceId,
          feature: context.feature,
          errorName: error instanceof Error ? error.name : "NonError",
        },
        "An AI call failed in a way the gateway does not know",
      );
    }
    await scope.record(outcome, reasonCode);
    return publicError(error);
  }

  private async prepare(
    context: AiCallContext,
    input: AiCallInput,
    scope: AiCallScope,
    signal: AbortSignal,
    jsonOutput?: AiStepRequest["jsonOutput"],
  ): Promise<PreparedCall> {
    await this.checkDestination(context);

    const images = input.images ?? [];
    if (images.length > this.limits.maxImagesPerRequest) {
      throw new AiImageLimitError(this.limits.maxImagesPerRequest);
    }
    const tools = input.tools ?? [];
    if (tools.length > 0 && context.actor === null) {
      throw new AiToolsNeedActorError();
    }

    const fence = this.promptGuard.open();
    const loop = new ToolLoop({
      provider: new ProviderRequests({
        provider: this.provider,
        meter: scope.meter,
        runtime: this.runtime,
        retry: this.retry,
        timeoutMs: this.limits.timeoutMs,
        maxAttempts: this.limits.maxAttempts,
      }),
      askPermission: (request) => this.permissions.ask(request),
      auditRefusal: async (refusal) => {
        try {
          await this.auditor.toolRefused(refusal);
        } catch {
          // The auditor logs its own failure. A refusal stays a refusal.
        }
      },
      maxToolSteps: this.limits.maxToolSteps,
      reportToolFailure: (failure) => {
        this.logger.warn(
          { ...failure, feature: context.feature },
          "An AI tool failed",
        );
      },
    });
    return {
      loop,
      loopInput: {
        request: {
          feature: context.feature,
          promptVersion: context.promptVersion,
          instructions: fence.withRules(input.instructions),
          maxOutputTokens: this.limits.maxOutputTokens,
          ...(jsonOutput ? { jsonOutput } : {}),
        },
        messages: this.messagesOf(input, fence),
        tools,
        context,
        fence,
        meter: scope.meter,
        signal,
      },
    };
  }

  /** The destination check. A policy that cannot answer is a refusal: nothing is sent on a guess. */
  private async checkDestination(context: AiCallContext): Promise<void> {
    let decision: AiDestinationDecision;
    try {
      decision = await this.destination.decide({
        provider: this.provider.kind,
        classification: context.classification,
        origin: context.origin,
      });
    } catch {
      decision = {
        allowed: false,
        rule: "policy-unavailable",
        reason: "The destination policy could not be asked.",
      };
    }
    if (decision.allowed) return;
    try {
      await this.auditor.destinationRefused({
        context,
        provider: this.provider.name,
        rule: decision.rule,
        reason: decision.reason,
      });
    } catch {
      // The auditor logs its own failure; the refusal below still happens.
    }
    throw new AiDestinationRefusedError(decision.rule, decision.reason);
  }

  private messagesOf(input: AiCallInput, fence: DataFence): AiMessage[] {
    const messages: AiMessage[] = (input.messages ?? []).map((message) =>
      message.role === "user"
        ? { role: "user", parts: [{ type: "text", text: message.text }] }
        : { role: "assistant", parts: [{ type: "text", text: message.text }] },
    );
    const data: (AiTextPart | AiImagePart)[] = [
      ...(input.documents ?? []).map((document): AiTextPart => ({
        type: "text",
        text: fence.wrap(document.label, document.text),
      })),
      ...(input.images ?? []),
    ];
    if (data.length > 0) {
      const last = messages.at(-1);
      if (last?.role === "user") {
        messages[messages.length - 1] = {
          role: "user",
          parts: [...last.parts, ...data],
        };
      } else {
        messages.push({ role: "user", parts: data });
      }
    }
    if (messages.length === 0) {
      throw new RangeError("A call needs a message, a document or an image.");
    }
    return messages;
  }

  /** Asks again, with the problem fed back, until the answer fits the schema or the attempts are spent. */
  private async answerInShape<T>(
    call: PreparedCall,
    schema: z.ZodType<T>,
    scope: AiCallScope,
  ): Promise<{ object: T; attempts: number }> {
    let messages: readonly AiMessage[] = call.loopInput.messages;
    for (let attempt = 1; attempt <= this.limits.maxAttempts; attempt += 1) {
      const answer = await call.loop.run({ ...call.loopInput, messages });
      const check = this.outputGuard.check(answer.text, schema);
      if (check.ok) return { object: check.value, attempts: attempt };
      messages = [
        ...answer.messages,
        { role: "user", parts: [{ type: "text", text: check.problem }] },
      ];
    }
    throw new AiInvalidOutputError(scope.meter.requests);
  }
}
