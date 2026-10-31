import { Inject, Injectable } from "@nestjs/common";
import {
  AI_USAGE_STATUSES,
  type AiUsage,
  type AiUsageByFeature,
  type AiUsageSummary,
  type PageQuery,
} from "@orderpilot/shared";
import { Database } from "../../database/database.js";

/**
 * The only place AiUsageRecord is read. It is written by the AI gateway
 * (P-17); until then the table is empty and every answer is zero.
 */
@Injectable()
export class AiUsageRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async summary(): Promise<AiUsageSummary> {
    const db = this.database.client.aiUsageRecord;
    const [totals, failedCalls] = await Promise.all([
      db.aggregate({
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, costUsd: true },
      }),
      db.count({ where: { status: { not: "ok" } } }),
    ]);
    return {
      calls: totals._count._all,
      inputTokens: totals._sum.inputTokens ?? 0,
      outputTokens: totals._sum.outputTokens ?? 0,
      costUsd: cost(totals._sum.costUsd),
      failedCalls,
    };
  }

  async byFeature(): Promise<AiUsageByFeature[]> {
    const rows = await this.database.client.aiUsageRecord.groupBy({
      by: ["feature"],
      _count: { _all: true },
      _sum: { costUsd: true },
      orderBy: { _sum: { costUsd: "desc" } },
    });
    return rows.map((row) => ({
      feature: row.feature,
      calls: row._count._all,
      costUsd: cost(row._sum.costUsd),
    }));
  }

  async page(query: PageQuery): Promise<{ items: AiUsage[]; total: number }> {
    const db = this.database.client.aiUsageRecord;
    const [rows, total] = await Promise.all([
      db.findMany({
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      db.count(),
    ]);
    return {
      total,
      items: rows.map((row) => ({
        id: row.id,
        occurredAt: row.occurredAt.toISOString(),
        feature: row.feature,
        provider: row.provider,
        model: row.model,
        promptVersion: row.promptVersion,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        costUsd: cost(row.costUsd),
        latencyMs: row.latencyMs,
        status: statusOf(row.status),
        userId: row.userId,
        traceId: row.traceId,
      })),
    };
  }
}

/** The column is text so area 1 can add a status without a migration; an unknown one reads as an error. */
function statusOf(value: string): AiUsage["status"] {
  return AI_USAGE_STATUSES.find((status) => status === value) ?? "error";
}

/** Four places, like every amount: a sum of nothing is "0.0000", never null. */
function cost(value: { toFixed(places: number): string } | null): string {
  return value === null ? "0.0000" : value.toFixed(4);
}
