import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AiUsageRecordRepository } from "../../src/modules/ai/ai-usage-record.repository.js";
import { Database } from "../../src/database/database.js";
import { AiUsageRepository } from "../../src/modules/monitoring/ai-usage.repository.js";
import { resetTestData } from "../support/reset.js";
import { createTestContext, type TestContext } from "../support/test-app.js";

const OCCURRED = new Date("2026-11-15T10:00:00.000Z");

function record(
  overrides: Partial<Parameters<AiUsageRecordRepository["insert"]>[0]> = {},
) {
  return {
    occurredAt: OCCURRED,
    feature: "gateway-probe",
    provider: "mock",
    model: "mock-1",
    promptVersion: "v1",
    inputTokens: 120,
    outputTokens: 30,
    costUsd: "0.0000",
    latencyMs: 42,
    status: "ok",
    userId: null,
    traceId: "trace-ai-usage",
    documentId: null,
    origin: "synthetic",
    classification: "public",
    attempts: 1,
    reasonCode: null,
    ...overrides,
  } as const satisfies Parameters<AiUsageRecordRepository["insert"]>[0];
}

describe("the AI usage record", () => {
  let t: TestContext;
  let writer: AiUsageRecordRepository;
  let reader: AiUsageRepository;
  let database: Database;

  beforeAll(async () => {
    await resetTestData({ seed: false });
    t = await createTestContext();
    database = t.app.get(Database);
    writer = new AiUsageRecordRepository(database);
    reader = t.app.get(AiUsageRepository, { strict: false });
  });
  afterAll(async () => {
    await t.close();
    await resetTestData();
  });

  it("is read back by area 4's reader exactly as it was written", async () => {
    await writer.insert(record({ costUsd: "0.0123", inputTokens: 1000 }));
    const { items, total } = await reader.page({ page: 1, pageSize: 10 });
    expect(total).toBe(1);
    expect(items[0]).toMatchObject({
      occurredAt: OCCURRED.toISOString(),
      feature: "gateway-probe",
      provider: "mock",
      model: "mock-1",
      promptVersion: "v1",
      inputTokens: 1000,
      outputTokens: 30,
      costUsd: "0.0123",
      latencyMs: 42,
      status: "ok",
      userId: null,
      traceId: "trace-ai-usage",
    });
  });

  it("keeps the gateway's own columns, and its summary counts a refusal as a failed call", async () => {
    await writer.insert(
      record({
        status: "refused",
        reasonCode: "real-data-not-allowed",
        attempts: 0,
        documentId: "doc-1",
        origin: "real",
        classification: "confidential",
        traceId: "trace-refused",
      }),
    );
    const row = await database.client.aiUsageRecord.findFirstOrThrow({
      where: { traceId: "trace-refused" },
    });
    expect(row).toMatchObject({
      status: "refused",
      reasonCode: "real-data-not-allowed",
      attempts: 0,
      documentId: "doc-1",
      origin: "real",
      classification: "confidential",
    });
    await expect(reader.summary()).resolves.toMatchObject({
      calls: 2,
      failedCalls: 1,
    });
    await expect(reader.byFeature()).resolves.toEqual([
      expect.objectContaining({ feature: "gateway-probe", calls: 2 }),
    ]);
  });
});
