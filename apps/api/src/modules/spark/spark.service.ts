import { createHash, randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type {
  PageQuery,
  Role,
  SparkAskResult,
  SparkConversation,
  SparkConversationDetail,
  SparkCreateConversation,
  SparkSource,
  SparkStep,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from "../../common/domain-error.js";
import { AppConfig } from "../../config/app-config.js";
import { Database } from "../../database/database.js";
import { AiStatusService } from "../ai/ai-status.service.js";
import type { AiCallContext } from "../ai/domain/ai-call-context.js";
import { LlmGateway, type AiStreamEvent } from "../ai/llm-gateway.js";
import { isAbandoned, type PendingLimits } from "./domain/pending-question.js";
import { failureOf, type SparkFailure } from "./domain/spark-failure.js";
import { HISTORY_MESSAGE_LIMIT, historyOf } from "./domain/spark-history.js";
import {
  SPARK_FEATURE,
  SPARK_INSTRUCTIONS,
  SPARK_PROMPT_VERSION,
} from "./domain/spark-instructions.js";
import { declaredOrigin } from "./domain/spark-origin.js";
import {
  SparkConversationRepository,
  type SparkScope,
  type StoredMessage,
} from "./spark-conversation.repository.js";
import { conversationOf, messageOf } from "./spark-message.mapper.js";
import { SparkRun } from "./spark-run.js";
import { SPARK_TOOL_NAMES, SparkToolset } from "./spark-toolset.js";

/** Injection token for the clock, so a test fixes the time. */
export const SPARK_NOW = "SPARK_NOW";

/** Who is asking, and from which request. Built by the controller from the session. */
export interface SparkCaller {
  readonly userId: string;
  readonly role: Role;
  readonly scope: SparkScope;
  /** The request id: the audit rows carry it, and so does the trace id of the gateway call. */
  readonly requestId: string;
  readonly ip: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TITLE_LENGTH = 80;

/** A conversation is named after its first question: the person's own words, short. */
function titleOf(question: string): string {
  const text = question.replace(/\s+/g, " ").trim();
  return text.length > TITLE_LENGTH
    ? `${text.slice(0, TITLE_LENGTH - 1)}…`
    : text;
}

/** The audit row holds a hash and a length of the text and never the text. */
function fingerprintOf(text: string): { length: number; sha256: string } {
  return {
    length: text.length,
    sha256: createHash("sha256").update(text).digest("hex"),
  };
}

/** What a question's tools did, as it is stored beside the answer. */
interface Trail {
  readonly sources: readonly SparkSource[];
  readonly steps: readonly SparkStep[];
}

/** What the gateway gave back, reduced to what is stored. */
type Outcome =
  | ({
      readonly kind: "ok";
      readonly text: string;
      readonly model: string;
      readonly mock: boolean;
      readonly inputTokens: number;
      readonly outputTokens: number;
      readonly requests: number;
      readonly finishReason: string;
    } & Trail)
  | ({ readonly kind: "failed"; readonly failure: SparkFailure } & Trail);

/** A refused tool is told to the person in the one word a destination refusal uses. */
const REFUSED_TOOL: SparkFailure = {
  code: "refused",
  outcome: "refused",
  reasonCode: "tool-refused",
};

/**
 * Spark's use cases. A question is two small transactions around the gateway
 * call, because the gateway refuses to run inside one: the first stores the
 * question and its audit event, the second stores the answer and its audit
 * event. Between them the question is pending, and that is what makes a
 * second question wait its turn. The model may ask for Spark's read-only
 * tools while it works; they run as the person asking, outside both
 * transactions, and what they looked at is stored with the answer.
 */
@Injectable()
export class SparkService {
  constructor(
    @Inject(SparkConversationRepository)
    private readonly conversations: SparkConversationRepository,
    @Inject(LlmGateway) private readonly gateway: LlmGateway,
    @Inject(AiStatusService) private readonly status: AiStatusService,
    @Inject(SparkToolset) private readonly toolset: SparkToolset,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(Database) private readonly database: Database,
    @Inject(AppConfig) private readonly config: AppConfig,
    @Inject(SPARK_NOW) private readonly now: () => Date,
  ) {}

  async list(
    caller: SparkCaller,
    query: PageQuery,
  ): Promise<{ items: SparkConversation[]; total: number }> {
    const { items, total } = await this.conversations.list(caller.scope, query);
    return { items: items.map(conversationOf), total };
  }

  create(
    caller: SparkCaller,
    input: SparkCreateConversation,
  ): Promise<SparkConversation> {
    return this.database.transaction(async () => {
      const stored = await this.conversations.create(
        caller.scope,
        input.title ?? null,
      );
      await this.record(caller, "spark.conversation.created", stored.id, {
        summary: "A Spark conversation was started.",
        changes: {},
      });
      return conversationOf(stored);
    });
  }

  async read(
    caller: SparkCaller,
    id: string,
  ): Promise<SparkConversationDetail> {
    const stored = await this.own(caller, id);
    const messages = await this.conversations.messages(stored.id);
    return {
      conversation: conversationOf(stored),
      messages: messages.map(messageOf),
    };
  }

  async archive(caller: SparkCaller, id: string): Promise<void> {
    await this.database.transaction(async () => {
      const archived = await this.conversations.archive(
        caller.scope,
        id,
        this.now(),
      );
      if (!archived) throw new NotFoundError("Conversation");
      await this.record(caller, "spark.conversation.archived", id, {
        summary: "A Spark conversation was archived.",
        changes: {},
      });
    });
  }

  async ask(
    caller: SparkCaller,
    conversationId: string,
    question: string,
  ): Promise<SparkAskResult> {
    const conversation = await this.own(caller, conversationId);
    await this.refuseOverDailyCap(caller);

    const asked = await this.storeQuestion(
      caller,
      conversation.id,
      conversation.title,
      question,
    );
    const answerId = randomUUID();
    // The request id is the caller's to choose, so the id of the answer joins it:
    // this is what the usage record is found by, and nobody else can write it.
    const traceId = `${caller.requestId}:${answerId}`;
    const outcome = await this.callGateway(caller, asked, question, traceId);
    const answered = await this.storeAnswer(
      caller,
      asked,
      answerId,
      traceId,
      outcome,
    );
    return { question: messageOf(asked), answer: messageOf(answered) };
  }

  /** The caller's own conversation. Unknown, someone else's and archived all read as not found. */
  private async own(caller: SparkCaller, id: string) {
    const stored = await this.conversations.find(caller.scope, id);
    if (stored === null) throw new NotFoundError("Conversation");
    return stored;
  }

  /**
   * The daily cap counts the person's questions in the last day, across all of
   * their conversations. Two questions that arrive together can both pass the
   * count: the cap bounds the cost, it is not an exact meter.
   */
  private async refuseOverDailyCap(caller: SparkCaller): Promise<void> {
    const since = new Date(this.now().getTime() - DAY_MS);
    const asked = await this.conversations.countQuestions(caller.userId, since);
    if (asked >= this.config.spark.questionsPerDay) {
      throw new DomainError(
        "RATE_LIMITED",
        "The daily limit of questions to Spark has been reached.",
      );
    }
  }

  private pendingLimits(): PendingLimits {
    const { timeoutMs, maxAttempts, maxToolSteps } = this.config.ai;
    return { timeoutMs, maxAttempts, maxToolSteps };
  }

  /**
   * First transaction: the question and its audit event. A question still
   * waiting for its answer refuses this one with 409, unless it has waited
   * past the gateway's time limit: then its process is gone, so it is closed
   * as failed here and this question goes ahead. The unique key on the
   * sequence number is the guarantee for two that arrive at once.
   */
  private storeQuestion(
    caller: SparkCaller,
    conversationId: string,
    title: string | null,
    question: string,
  ): Promise<StoredMessage> {
    return this.database.transaction(async () => {
      const last = await this.conversations.last(conversationId);
      let seq = (last?.seq ?? 0) + 1;
      if (last?.role === "USER") {
        if (!isAbandoned(last.createdAt, this.now(), this.pendingLimits())) {
          throw new ConflictError(
            "Spark is already answering a question in this conversation.",
          );
        }
        await this.closeAbandoned(caller, last);
        seq += 1;
      }
      const stored = await this.conversations.append({
        id: randomUUID(),
        conversationId,
        seq,
        role: "USER",
        status: "OK",
        content: question,
        actorRole: caller.role,
        traceId: caller.requestId,
      });
      await this.conversations.touch(
        conversationId,
        this.now(),
        title === null ? titleOf(question) : null,
      );
      await this.record(caller, "spark.question.asked", conversationId, {
        summary: "A question was asked in a Spark conversation.",
        changes: { messageId: stored.id, seq, ...fingerprintOf(question) },
      });
      return stored;
    });
  }

  private async closeAbandoned(
    caller: SparkCaller,
    question: StoredMessage,
  ): Promise<void> {
    const id = randomUUID();
    const closed = await this.conversations.append({
      id,
      conversationId: question.conversationId,
      seq: question.seq + 1,
      role: "ASSISTANT",
      status: "FAILED",
      content: "",
      actorRole: caller.role,
      errorCode: "abandoned",
      traceId: `${caller.requestId}:${id}`,
    });
    await this.record(caller, "spark.answer.failed", question.conversationId, {
      summary: "A Spark question that nobody answered in time was closed.",
      changes: {
        messageId: closed.id,
        questionMessageId: question.id,
        errorCode: "abandoned",
      },
    });
  }

  /**
   * The model call, outside any transaction, with Spark's tools for this one
   * question. Whatever goes wrong becomes a failed answer with a safe code: the
   * gateway has already written its usage record and, for a refusal, its audit
   * event. What the tools looked at is kept on a failure too, because the
   * record of what was read matters most when something went wrong.
   *
   * It reads the gateway's stream and not its plain call because only the
   * stream reports each tool call, including the ones a permission refused. No
   * text reaches the person as it arrives: the answer is stored whole.
   */
  private async callGateway(
    caller: SparkCaller,
    asked: StoredMessage,
    question: string,
    traceId: string,
  ): Promise<Outcome> {
    const run = new SparkRun();
    try {
      const earlier = await this.conversations.before(
        asked.conversationId,
        asked.seq,
        HISTORY_MESSAGE_LIMIT,
      );
      let final: Extract<AiStreamEvent, { type: "final" }> | null = null;
      for await (const event of this.gateway.streamText(
        this.contextOf(caller, traceId),
        {
          instructions: SPARK_INSTRUCTIONS,
          messages: [...historyOf(earlier), { role: "user", text: question }],
          tools: this.toolset.forRun(run),
        },
      )) {
        if (event.type === "tool-activity") {
          run.noteStep({ tool: event.name, status: event.status });
        } else if (event.type === "final") {
          final = event;
        }
      }
      if (final === null) throw new Error("The gateway ended with no answer.");
      const trail = { sources: run.sources, steps: run.steps };
      if (run.hasUnresolvedRefusal(SPARK_TOOL_NAMES)) {
        return { kind: "failed", failure: REFUSED_TOOL, ...trail };
      }
      return {
        kind: "ok",
        text: final.text,
        model: final.usage.model,
        mock: final.mock,
        inputTokens: final.usage.inputTokens,
        outputTokens: final.usage.outputTokens,
        requests: final.usage.requests,
        finishReason: final.finishReason,
        ...trail,
      };
    } catch (error) {
      return {
        kind: "failed",
        failure: failureOf(error),
        sources: run.sources,
        steps: run.steps,
      };
    }
  }

  /**
   * What the destination check is told. Nothing here is guessed: the origin
   * comes from one function that fails closed, and the classification is the
   * highest any of Spark's data can carry.
   */
  private contextOf(caller: SparkCaller, traceId: string): AiCallContext {
    return {
      feature: SPARK_FEATURE,
      promptVersion: SPARK_PROMPT_VERSION,
      classification: "confidential",
      origin: declaredOrigin(() => this.config.dataOrigin),
      actor: { userId: caller.userId, role: caller.role },
      traceId,
    };
  }

  /**
   * Second transaction: the answer and its audit event. If the question was
   * closed as abandoned while the model was still working, its place is taken
   * and the late answer is refused with 409, as a second question would be.
   */
  private storeAnswer(
    caller: SparkCaller,
    asked: StoredMessage,
    answerId: string,
    traceId: string,
    outcome: Outcome,
  ): Promise<StoredMessage> {
    return this.database.transaction(async () => {
      const provider = this.status.status().provider;
      const stored = await this.conversations.append({
        id: answerId,
        conversationId: asked.conversationId,
        seq: asked.seq + 1,
        role: "ASSISTANT",
        actorRole: caller.role,
        traceId,
        sources: outcome.sources,
        steps: outcome.steps,
        ...(outcome.kind === "ok"
          ? {
              status: "OK" as const,
              content: outcome.text,
              provider,
              model: outcome.model,
              mock: outcome.mock,
              inputTokens: outcome.inputTokens,
              outputTokens: outcome.outputTokens,
              finishReason: outcome.finishReason,
            }
          : {
              status: "FAILED" as const,
              content: "",
              errorCode: outcome.failure.code,
            }),
      });
      await this.conversations.touch(asked.conversationId, this.now(), null);
      await this.record(
        caller,
        outcome.kind === "ok" ? "spark.answer.recorded" : "spark.answer.failed",
        asked.conversationId,
        {
          summary:
            outcome.kind === "ok"
              ? "Spark answered a question."
              : "Spark could not answer a question.",
          changes: this.answerChanges(
            asked,
            stored,
            traceId,
            provider,
            outcome,
          ),
        },
      );
      return stored;
    });
  }

  private answerChanges(
    asked: StoredMessage,
    stored: StoredMessage,
    traceId: string,
    provider: string,
    outcome: Outcome,
  ): Record<string, unknown> {
    const base = {
      messageId: stored.id,
      questionMessageId: asked.id,
      traceId,
      // The tools the model asked for, and the ones among them that were refused.
      tools: [...new Set(outcome.steps.map((step) => step.tool))],
      refusedTools: [
        ...new Set(
          outcome.steps
            .filter((step) => step.status === "refused")
            .map((step) => step.tool),
        ),
      ],
      sourceCount: outcome.sources.length,
    };
    if (outcome.kind === "failed") {
      return {
        ...base,
        status: "FAILED",
        errorCode: outcome.failure.code,
        outcome: outcome.failure.outcome,
        reasonCode: outcome.failure.reasonCode,
      };
    }
    return {
      ...base,
      status: "OK",
      ...fingerprintOf(outcome.text),
      provider,
      model: outcome.model,
      mock: outcome.mock,
      inputTokens: outcome.inputTokens,
      outputTokens: outcome.outputTokens,
      requests: outcome.requests,
      finishReason: outcome.finishReason,
    };
  }

  private record(
    caller: SparkCaller,
    action: string,
    conversationId: string,
    event: { summary: string; changes: Record<string, unknown> },
  ): Promise<unknown> {
    return this.audit.record({
      actor: { kind: "user", userId: caller.userId, role: caller.role },
      action,
      entityType: "SparkConversation",
      entityId: conversationId,
      summary: event.summary,
      changes: event.changes,
      ip: caller.ip,
      traceId: caller.requestId,
    });
  }
}
