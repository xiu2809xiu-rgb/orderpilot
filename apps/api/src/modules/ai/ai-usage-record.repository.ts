import { Inject, Injectable } from "@nestjs/common";
import type { AiProviderSetting, AiUsage } from "@orderpilot/shared";
import { Database } from "../../database/database.js";

/** One row of AiUsageRecord, as the tracker writes it. Metadata only. */
export interface NewAiUsageRecord {
  readonly occurredAt: Date;
  readonly feature: string;
  /** The AI_PROVIDER setting's name. */
  readonly provider: AiProviderSetting;
  readonly model: string;
  readonly promptVersion: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** USD, a decimal string with four places. An estimate. */
  readonly costUsd: string;
  readonly latencyMs: number;
  readonly status: AiUsage["status"];
  readonly userId: string | null;
  readonly traceId: string;
  readonly documentId: string | null;
  readonly origin: string;
  readonly classification: string;
  readonly attempts: number;
  /** A short code for an outcome that is not ok. Never a message. */
  readonly reasonCode: string | null;
}

/**
 * The only place AiUsageRecord is written (area 4's AiUsageRepository only
 * reads it). Prisma is called here and nowhere else in the AI module.
 *
 * It uses the plain client on purpose: the gateway refuses to run inside a
 * transaction, so a record never joins one and a rollback cannot erase the
 * record of money spent.
 */
@Injectable()
export class AiUsageRecordRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async insert(record: NewAiUsageRecord): Promise<void> {
    await this.database.client.aiUsageRecord.create({ data: { ...record } });
  }
}
