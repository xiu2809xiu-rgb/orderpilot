import { AiCallMeter } from "./domain/ai-call-meter.js";
import type { AiCallContext } from "./domain/ai-call-context.js";
import type { AiCallOutcome } from "./domain/ai-errors.js";
import type { AiRuntime } from "./domain/ai-runtime.js";
import type { LlmProvider } from "./domain/llm-provider.js";
import type { AiUsageEntry } from "./ai-usage.tracker.js";

/** What one gateway call used, as its caller sees it. */
export interface AiCallUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Provider requests made: a retry or a tool step adds one. */
  readonly requests: number;
  readonly latencyMs: number;
}

/** Where the usage record of a call is written. The tracker never throws. */
export interface AiUsageSink {
  record(entry: AiUsageEntry): Promise<void>;
}

/**
 * The bookkeeping of ONE gateway call: its meter, its clock, and the one usage
 * record it owes. `record` writes that record at most once however many paths
 * reach it (the end, an error, a consumer that stops reading a stream), which
 * is what makes "one record per call" true on every path.
 */
export class AiCallScope {
  readonly meter = new AiCallMeter();
  private readonly startedAt: number;
  private latencyMs: number | null = null;
  private written = false;

  constructor(
    private readonly context: AiCallContext,
    private readonly provider: Pick<LlmProvider, "name" | "model" | "mock">,
    private readonly sink: AiUsageSink,
    private readonly runtime: AiRuntime,
  ) {
    this.startedAt = runtime.now();
  }

  get recorded(): boolean {
    return this.written;
  }

  usage(): AiCallUsage {
    return {
      inputTokens: this.meter.inputTokens,
      outputTokens: this.meter.outputTokens,
      requests: this.meter.requests,
      latencyMs: this.latencyMs ?? this.elapsed(),
    };
  }

  async record(
    status: AiCallOutcome,
    reasonCode: string | null,
  ): Promise<void> {
    // Set before the first await: two paths ending at once write one row.
    if (this.written) return;
    this.written = true;
    this.latencyMs = this.elapsed();
    await this.sink.record({
      context: this.context,
      provider: this.provider.name,
      model: this.provider.model,
      mock: this.provider.mock,
      inputTokens: this.meter.inputTokens,
      outputTokens: this.meter.outputTokens,
      attempts: this.meter.requests,
      latencyMs: this.latencyMs,
      status,
      reasonCode,
      occurredAt: new Date(this.startedAt),
    });
  }

  private elapsed(): number {
    return Math.max(0, this.runtime.now() - this.startedAt);
  }
}
