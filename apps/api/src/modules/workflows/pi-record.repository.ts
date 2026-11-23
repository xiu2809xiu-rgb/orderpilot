import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import { ConflictError, NotFoundError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { Prisma } from "../../generated/prisma/client.js";

const reversalSchema = z.object({
  /** The issue that was reversed. */
  issue: z.number().int().min(1),
  reason: z.string().min(1),
  at: z.iso.datetime(),
  by: z.string().min(1),
});

const piDataSchema = z.object({
  /** 1 when first sent; each reverse and reissue adds one. */
  issue: z.number().int().min(1),
  sentAt: z.iso.datetime(),
  sentBy: z.string().min(1),
  /** Every reversal, oldest first, each with the reason it was given. */
  reversals: z.array(reversalSchema),
});
export type PiData = z.infer<typeof piDataSchema>;
export type PiReversal = z.infer<typeof reversalSchema>;

/** A PI that has been sent: its number and its issues. */
export interface SentPi extends PiData {
  readonly id: string;
  readonly recordNo: string;
  /** What `reissue` checks, so a stale read never overwrites a newer one. */
  readonly updatedAt: Date;
}

const PI_TYPE = "PI";

/**
 * A PI's own record (`WorkflowRecord`, type PI): when it went out, and every
 * reverse and reissue since, each with its reason. An unsent PI has no data.
 * Found through its order, as an SPR is.
 */
@Injectable()
export class PiRecordRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** The order's PI record, sent or not; null when the order has none. */
  private async rowOf(orderRef: string) {
    return this.database.client.workflowRecord.findFirst({
      where: { recordType: PI_TYPE, instance: { orderRef } },
      select: { id: true, recordNo: true, data: true, updatedAt: true },
    });
  }

  /** The PI as sent, or null when it has not been sent or there is none. */
  async sentOf(orderRef: string): Promise<SentPi | null> {
    const row = await this.rowOf(orderRef);
    if (!row?.data) return null;
    return {
      ...piDataSchema.parse(row.data),
      id: row.id,
      recordNo: row.recordNo,
      updatedAt: row.updatedAt,
    };
  }

  /** The PI's number, sent or not, for a task that points at it. */
  async numberOf(orderRef: string): Promise<string | null> {
    return (await this.rowOf(orderRef))?.recordNo ?? null;
  }

  /** Records the first issue going out. */
  async markSent(orderRef: string, by: string, at: Date): Promise<void> {
    const row = await this.rowOf(orderRef);
    if (!row) throw new NotFoundError(`A PI for ${orderRef}`);
    if (row.data !== null) {
      throw new ConflictError("This PI has already been sent.");
    }
    const data: PiData = {
      issue: 1,
      sentAt: at.toISOString(),
      sentBy: by,
      reversals: [],
    };
    await this.database.client.workflowRecord.update({
      where: { id: row.id },
      data: { data },
    });
  }

  /** Takes back the mark that it was sent, as if it never went. */
  async unmarkSent(orderRef: string): Promise<void> {
    const sent = await this.sentOf(orderRef);
    if (!sent) throw new NotFoundError(`A sent PI for ${orderRef}`);
    if (sent.reversals.length > 0) {
      throw new ConflictError(
        "This PI has been reissued, so it was really sent. Reverse and reissue it instead.",
      );
    }
    await this.database.client.workflowRecord.update({
      where: { id: sent.id },
      data: { data: Prisma.DbNull },
    });
  }

  /** Reverses the current issue and sends the next. Refuses a stale read. */
  async reissue(
    sent: SentPi,
    reversal: { reason: string; by: string; at: Date },
  ): Promise<PiData> {
    const data: PiData = {
      issue: sent.issue + 1,
      sentAt: reversal.at.toISOString(),
      sentBy: reversal.by,
      reversals: [
        ...sent.reversals,
        {
          issue: sent.issue,
          reason: reversal.reason,
          at: reversal.at.toISOString(),
          by: reversal.by,
        },
      ],
    };
    const { count } = await this.database.client.workflowRecord.updateMany({
      where: { id: sent.id, updatedAt: sent.updatedAt },
      data: { data },
    });
    if (count === 0) {
      throw new ConflictError(
        "Someone else changed this PI first. Reload it and try again.",
      );
    }
    return data;
  }
}
