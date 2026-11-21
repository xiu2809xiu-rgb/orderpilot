import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  AiUsageRecordRepository,
  NewAiUsageRecord,
} from "./ai-usage-record.repository.js";
import { AiUsageTracker, type AiUsageEntry } from "./ai-usage.tracker.js";
import type { AiCallContext } from "./domain/ai-call-context.js";
import { AiPricing } from "./domain/ai-pricing.js";

class FakeRepository {
  readonly rows: NewAiUsageRecord[] = [];
  failWith: Error | null = null;

  insert(record: NewAiUsageRecord): Promise<void> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.rows.push(record);
    return Promise.resolve();
  }
}

const context: AiCallContext = {
  feature: "document-extraction",
  promptVersion: "v2",
  classification: "internal",
  origin: "synthetic",
  actor: { userId: "0190a1b2-0000-7000-8000-000000000001", role: "SUPPORT" },
  traceId: "trace-usage",
  documentId: "doc-7",
};

const entry: AiUsageEntry = {
  context,
  provider: "groq",
  model: "some-model",
  mock: false,
  inputTokens: 1_000_000,
  outputTokens: 500_000,
  attempts: 2,
  latencyMs: 412.6,
  status: "ok",
  reasonCode: null,
  occurredAt: new Date("2026-11-16T08:00:00.000Z"),
};

function tracker(
  repository: FakeRepository,
  prices = { in: "0.10", out: "0.40" },
) {
  return new AiUsageTracker(
    repository as unknown as AiUsageRecordRepository,
    new AiPricing({
      inputUsdPerMtok: prices.in,
      outputUsdPerMtok: prices.out,
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the usage tracker", () => {
  it("writes one record with the call's figures, the setting's name and the estimated cost", async () => {
    const repository = new FakeRepository();
    await tracker(repository).record(entry);
    expect(repository.rows).toEqual([
      {
        occurredAt: new Date("2026-11-16T08:00:00.000Z"),
        feature: "document-extraction",
        provider: "groq",
        model: "some-model",
        promptVersion: "v2",
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        // 1 Mtok at 0.10 plus 0.5 Mtok at 0.40.
        costUsd: "0.3000",
        latencyMs: 413,
        status: "ok",
        userId: "0190a1b2-0000-7000-8000-000000000001",
        traceId: "trace-usage",
        documentId: "doc-7",
        origin: "synthetic",
        classification: "internal",
        attempts: 2,
        reasonCode: null,
      },
    ]);
  });

  it("costs nothing for the mock, whatever the prices say", async () => {
    const repository = new FakeRepository();
    await tracker(repository).record({
      ...entry,
      mock: true,
      provider: "mock",
    });
    expect(repository.rows[0]?.costUsd).toBe("0.0000");
  });

  it("writes a background job with no person and no document as nulls", async () => {
    const repository = new FakeRepository();
    // Written out, not spread: a job has no person and names no document.
    const jobContext: AiCallContext = {
      feature: context.feature,
      promptVersion: context.promptVersion,
      classification: context.classification,
      origin: context.origin,
      actor: null,
      traceId: context.traceId,
    };
    await tracker(repository).record({
      ...entry,
      context: jobContext,
      status: "refused",
      reasonCode: "default-synthetic-only",
      inputTokens: 0,
      outputTokens: 0,
      attempts: 0,
    });
    expect(repository.rows[0]).toMatchObject({
      userId: null,
      documentId: null,
      status: "refused",
      reasonCode: "default-synthetic-only",
      costUsd: "0.0000",
      attempts: 0,
    });
  });

  describe("when the write fails", () => {
    it("does not throw into the caller", async () => {
      vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      const repository = new FakeRepository();
      repository.failWith = new Error("connection lost");
      await expect(tracker(repository).record(entry)).resolves.toBeUndefined();
    });

    it("logs the trace id and the error's class, and none of the call's content or the error's message", async () => {
      const logged = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
      const repository = new FakeRepository();
      repository.failWith = new TypeError(
        'Unique constraint failed on (traceId)=("trace-usage") with SECRET-VALUE',
      );
      await tracker(repository).record(entry);
      expect(logged).toHaveBeenCalledTimes(1);
      const line = JSON.stringify(logged.mock.calls[0]);
      expect(line).toContain("trace-usage");
      expect(line).toContain("TypeError");
      expect(line).not.toContain("SECRET-VALUE");
      expect(line).not.toContain("doc-7");
    });

    it("also survives a figure the pricing refuses, such as a fractional token count", async () => {
      vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      const repository = new FakeRepository();
      await expect(
        tracker(repository).record({ ...entry, inputTokens: 1.5 }),
      ).resolves.toBeUndefined();
      expect(repository.rows).toEqual([]);
    });
  });
});
