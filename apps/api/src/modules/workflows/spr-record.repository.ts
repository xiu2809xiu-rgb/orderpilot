import { Inject, Injectable } from "@nestjs/common";
import { decimalStringSchema, SPR_DECISIONS } from "@orderpilot/shared";
import { z } from "zod";
import { ConflictError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";

const sprDataSchema = z.object({
  /** What the approver's limit is set against. Read here, never from a request. */
  amount: decimalStringSchema,
  /** Who raised it, so they can never decide it. */
  requesterUserId: z.uuid(),
  decision: z
    .object({
      outcome: z.enum(SPR_DECISIONS),
      by: z.string().min(1),
      comment: z.string(),
      at: z.iso.datetime(),
    })
    .nullable()
    .default(null),
  /** Set when an SPR above someone's limit has gone on up the chain. */
  passedOn: z
    .object({
      /** Who the next step on the chain follows from. */
      byUserId: z.uuid(),
      byName: z.string().min(1),
      toName: z.string().min(1),
      /** What they asked for, which nobody has decided yet. */
      outcome: z.enum(SPR_DECISIONS),
      comment: z.string(),
      at: z.iso.datetime(),
    })
    .nullable()
    .default(null),
});
export type SprData = z.infer<typeof sprDataSchema>;

export interface StoredSpr extends SprData {
  readonly id: string;
  readonly orderRef: string;
  /** What `save` checks, so a stale read can never overwrite a newer decision. */
  readonly updatedAt: Date;
}

const SPR_TYPE = "SPR";

/**
 * An SPR's own record: what its limit and its requester are read from. It is
 * found through its order, because the demo's SPR numbers carry a date that the
 * dataset moves every day, while an order's number stays the same.
 */
@Injectable()
export class SprRecordRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** Null when there is no data, as for a sample the workflow does not run. */
  async findByOrder(orderRef: string): Promise<StoredSpr | null> {
    const row = await this.database.client.workflowRecord.findFirst({
      where: { recordType: SPR_TYPE, instance: { orderRef } },
      select: { id: true, data: true, updatedAt: true },
    });
    if (!row) return null;
    if (row.data === null) return null;
    return {
      ...sprDataSchema.parse(row.data),
      id: row.id,
      orderRef,
      updatedAt: row.updatedAt,
    };
  }

  /** The orders among these whose SPR task is finished: decided, or passed on. */
  async finished(orderRefs: readonly string[]): Promise<ReadonlySet<string>> {
    if (orderRefs.length === 0) return new Set();
    const rows = await this.database.client.workflowRecord.findMany({
      where: {
        recordType: SPR_TYPE,
        instance: { orderRef: { in: [...orderRefs] } },
      },
      select: { data: true, instance: { select: { orderRef: true } } },
    });
    return new Set(
      rows.flatMap((row) => {
        const data = sprDataSchema.safeParse(row.data);
        return row.instance &&
          data.success &&
          (data.data.decision || data.data.passedOn)
          ? [row.instance.orderRef]
          : [];
      }),
    );
  }

  /** Refuses if the record changed since it was read. */
  async save(spr: StoredSpr, changes: Partial<SprData>): Promise<void> {
    const { amount, requesterUserId, decision, passedOn } = {
      ...spr,
      ...changes,
    };
    const { count } = await this.database.client.workflowRecord.updateMany({
      where: { id: spr.id, updatedAt: spr.updatedAt },
      data: { data: { amount, requesterUserId, decision, passedOn } },
    });
    if (count === 0) {
      throw new ConflictError(
        "Someone else changed this request first. Reload it and try again.",
      );
    }
  }
}
