import { randomUUID } from "node:crypto";
import { ModulesContainer } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import type { INestApplicationContext } from "@nestjs/common";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { AppModule } from "../../src/app.module.js";
import { AuthModule } from "../../src/auth/auth.module.js";
import { AuditEventRepository } from "../../src/audit/audit-event.repository.js";
import { Database } from "../../src/database/database.js";
import type { AiCallContext } from "../../src/modules/ai/domain/ai-call-context.js";
import {
  AiCallInTransactionError,
  AiDestinationRefusedError,
} from "../../src/modules/ai/domain/ai-errors.js";
import { defineReadOnlyTool } from "../../src/modules/ai/domain/read-only-tool.js";
import { LlmGateway } from "../../src/modules/ai/llm-gateway.js";
import {
  MockScriptRegistry,
  mockText,
  mockToolCalls,
} from "../../src/modules/ai/providers/mock-scripts.js";
import { AiUsageRepository } from "../../src/modules/monitoring/ai-usage.repository.js";
import { resetTestData, testConfig } from "../support/reset.js";

// The gateway wired into the real module graph: the real policy, the real
// permission matrix, the real audit chain and the real usage table.

const actor = { userId: randomUUID(), role: "SUPPORT" } as const;

const context = (feature: string): AiCallContext => ({
  feature,
  promptVersion: "v1",
  classification: "internal",
  origin: "synthetic",
  actor,
  traceId: `trace-${feature}`,
});

const input = {
  instructions: "Go.",
  messages: [{ role: "user", text: "q" }],
} as const;

describe("the AI gateway in the real module graph", () => {
  let app: INestApplicationContext;
  let gateway: LlmGateway;
  let scripts: MockScriptRegistry;
  let database: Database;
  let reader: AiUsageRepository;
  let audit: AuditEventRepository;

  beforeAll(async () => {
    // Seeded: the permission matrix lives in the database.
    await resetTestData();
    const config = testConfig();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    }).compile();
    app = await moduleRef.init();
    gateway = app.get(LlmGateway, { strict: false });
    scripts = app.get(MockScriptRegistry, { strict: false });
    database = app.get(Database);
    reader = app.get(AiUsageRepository, { strict: false });
    audit = app.get(AuditEventRepository, { strict: false });
  });
  afterAll(async () => {
    await app.close();
    await resetTestData();
  });

  it("leaves the application with exactly one AuthModule", () => {
    // Nest tells dynamic modules apart by object reference: a second
    // AuthModule.register() call would build a second copy of the sign-in
    // controllers and providers.
    const modules = [...app.get(ModulesContainer).values()];
    expect(modules.filter((m) => m.metatype === AuthModule)).toHaveLength(1);
  });

  it("answers from the production mock script and leaves one record the monitoring reader sees", async () => {
    const result = await gateway.generateText(context("gateway-probe"), input);
    expect(result).toMatchObject({
      text: "Gateway probe: the mock provider is answering.",
      mock: true,
    });
    const { items } = await reader.page({ page: 1, pageSize: 10 });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      feature: "gateway-probe",
      provider: "mock",
      status: "ok",
      costUsd: "0.0000",
      userId: actor.userId,
      traceId: "trace-gateway-probe",
    });
  });

  it("refuses real data under the default policy, audits the rule, and writes a refused record", async () => {
    scripts.register("refusal-feature", () => mockText("never"));
    await expect(
      gateway.generateText(
        { ...context("refusal-feature"), origin: "real" },
        input,
      ),
    ).rejects.toBeInstanceOf(AiDestinationRefusedError);
    await expect(audit.existsByAction("ai.destination.refused")).resolves.toBe(
      true,
    );
    const row = await database.client.aiUsageRecord.findFirstOrThrow({
      where: { feature: "refusal-feature" },
    });
    expect(row).toMatchObject({
      status: "refused",
      reasonCode: "synthetic-data-only",
      origin: "real",
      attempts: 0,
    });
  });

  it("is refused inside a transaction and leaves no record, even after the transaction commits", async () => {
    scripts.register("transaction-feature", () => mockText("never"));
    await expect(
      database.transaction(() =>
        gateway.generateText(context("transaction-feature"), input),
      ),
    ).rejects.toBeInstanceOf(AiCallInTransactionError);
    await expect(
      database.client.aiUsageRecord.count({
        where: { feature: "transaction-feature" },
      }),
    ).resolves.toBe(0);
  });

  it("writes a usage record that survives a caller whose own work rolls back", async () => {
    scripts.register("rollback-feature", () => mockText("fine"));
    await gateway.generateText(context("rollback-feature"), input);
    await expect(
      database.transaction(async () => {
        await Promise.resolve();
        throw new Error("business rule said no");
      }),
    ).rejects.toThrow("business rule said no");
    await expect(
      database.client.aiUsageRecord.count({
        where: { feature: "rollback-feature" },
      }),
    ).resolves.toBe(1);
  });

  it("runs a tool the person's role holds, and refuses and audits one it does not", async () => {
    let ran = 0;
    const tool = (
      name: string,
      permission: "orders.read" | "settings.manage",
    ) =>
      defineReadOnlyTool({
        name,
        description: "A read.",
        inputSchema: z.object({}),
        permission,
        execute: () => {
          ran += 1;
          return Promise.resolve({ ok: true });
        },
      });
    scripts.register("tool-feature", (script) =>
      script.toolResults.length === 0
        ? mockToolCalls([
            { name: "read_orders", input: {} },
            { name: "change_settings", input: {} },
          ])
        : mockText("done"),
    );
    const result = await gateway.generateText(context("tool-feature"), {
      ...input,
      tools: [
        tool("read_orders", "orders.read"),
        tool("change_settings", "settings.manage"),
      ],
    });
    expect(result.text).toBe("done");
    // SUPPORT holds orders.read and does not hold settings.manage.
    expect(ran).toBe(1);
    await expect(audit.existsByAction("ai.tool.refused")).resolves.toBe(true);
  });
});
