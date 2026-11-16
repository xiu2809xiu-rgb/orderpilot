import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AiProviderSetting } from "@orderpilot/shared";
import type { AiCallContext } from "./domain/ai-call-context.js";
import type { AiCallOutcome } from "./domain/ai-errors.js";
import { AiPricing } from "./domain/ai-pricing.js";
import { AiUsageRecordRepository } from "./ai-usage-record.repository.js";

/** What the gateway knows when a call ends. Never a prompt, a document or an answer. */
export interface AiUsageEntry {
  readonly context: AiCallContext;
  readonly provider: AiProviderSetting;
  readonly model: string;
  readonly mock: boolean;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Provider requests made: a retry adds one. */
  readonly attempts: number;
  readonly latencyMs: number;
  readonly status: AiCallOutcome;
  /** A short code when the status is not ok. Never a message. */
  readonly reasonCode: string | null;
  readonly occurredAt: Date;
}

/**
 * Writes the one usage record of a gateway call. It never throws into the
 * caller: a model call that worked must not fail because a cost row could not
 * be saved, and a refusal must still be a refusal. A failed write is logged
 * with the trace id and the error's class only, because a database error can
 * quote the values it was given.
 */
@Injectable()
export class AiUsageTracker {
  private readonly logger = new Logger(AiUsageTracker.name);

  constructor(
    @Inject(AiUsageRecordRepository)
    private readonly records: AiUsageRecordRepository,
    @Inject(AiPricing) private readonly pricing: AiPricing,
  ) {}

  async record(entry: AiUsageEntry): Promise<void> {
    try {
      const { context } = entry;
      await this.records.insert({
        occurredAt: entry.occurredAt,
        feature: context.feature,
        provider: entry.provider,
        model: entry.model,
        promptVersion: context.promptVersion,
        inputTokens: entry.inputTokens,
        outputTokens: entry.outputTokens,
        costUsd: this.pricing.estimate(
          {
            inputTokens: entry.inputTokens,
            outputTokens: entry.outputTokens,
          },
          { mock: entry.mock },
        ),
        latencyMs: Math.max(0, Math.round(entry.latencyMs)),
        status: entry.status,
        userId: context.actor?.userId ?? null,
        traceId: context.traceId,
        documentId: context.documentId ?? null,
        origin: context.origin,
        classification: context.classification,
        attempts: entry.attempts,
        reasonCode: entry.reasonCode,
      });
    } catch (error) {
      this.logger.error(
        {
          traceId: entry.context.traceId,
          feature: entry.context.feature,
          errorName: error instanceof Error ? error.name : "NonError",
        },
        "Could not write an AI usage record",
      );
    }
  }
}
