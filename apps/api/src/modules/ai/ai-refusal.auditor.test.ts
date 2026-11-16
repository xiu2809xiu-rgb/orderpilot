import { Logger } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AuditInput, AuditService } from "../../audit/audit.service.js";
import { AiRefusalAuditor } from "./ai-refusal.auditor.js";
import type { AiCallContext } from "./domain/ai-call-context.js";

const context: AiCallContext = {
  feature: "spark",
  promptVersion: "v1",
  classification: "confidential",
  origin: "real",
  actor: { userId: "0190a1b2-0000-7000-8000-000000000001", role: "SUPPORT" },
  traceId: "trace-audit",
  documentId: "doc-9",
};

function auditor(fail = false) {
  const events: AuditInput[] = [];
  const service = {
    record: (input: AuditInput) => {
      if (fail) return Promise.reject(new Error("db down: secret detail"));
      events.push(input);
      return Promise.resolve({});
    },
  };
  return {
    events,
    auditor: new AiRefusalAuditor(service as unknown as AuditService),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("the AI refusal auditor", () => {
  it("writes a destination refusal with the rule and the reason, as the asking person", async () => {
    const h = auditor();
    await h.auditor.destinationRefused({
      context,
      provider: "groq",
      rule: "synthetic-data-only",
      reason: "Only synthetic data may go to groq; this is real data.",
    });
    expect(h.events).toHaveLength(1);
    expect(h.events[0]).toMatchObject({
      actor: { kind: "user", userId: context.actor?.userId, role: "SUPPORT" },
      action: "ai.destination.refused",
      traceId: "trace-audit",
      changes: {
        rule: "synthetic-data-only",
        reason: "Only synthetic data may go to groq; this is real data.",
        provider: "groq",
        origin: "real",
        classification: "confidential",
      },
    });
  });

  it("writes a call with no person as the gateway itself", async () => {
    const h = auditor();
    await h.auditor.destinationRefused({
      context: { ...context, actor: null },
      provider: "mock",
      rule: "r",
      reason: "why",
    });
    expect(h.events[0]?.actor).toEqual({ kind: "system", name: "ai-gateway" });
  });

  it("writes a tool refusal with its kind, permission and count, and no arguments", async () => {
    const h = auditor();
    await h.auditor.toolRefused({
      kind: "permission-denied",
      toolName: "stock_lookup",
      actor: context.actor,
      permission: "orders.read",
      reason: "role-lacks-permission",
      count: 1,
      context,
    });
    expect(h.events[0]).toMatchObject({
      action: "ai.tool.refused",
      entityId: "stock_lookup",
      changes: {
        kind: "permission-denied",
        permission: "orders.read",
        reason: "role-lacks-permission",
        count: 1,
        documentId: "doc-9",
      },
    });
  });

  it("does not throw when the audit write fails, and logs only the error's class", async () => {
    const log = vi
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    const h = auditor(true);
    await expect(
      h.auditor.destinationRefused({
        context,
        provider: "groq",
        rule: "r",
        reason: "why",
      }),
    ).resolves.toBeUndefined();
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret detail");
    expect(log).toHaveBeenCalledOnce();
  });
});
