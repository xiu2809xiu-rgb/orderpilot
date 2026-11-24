import { Inject, Injectable } from "@nestjs/common";
import {
  decimalStringSchema,
  SPR_DECISIONS,
  type OrderStatus,
} from "@orderpilot/shared";
import { z } from "zod";
import { ConflictError, NotFoundError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { Prisma } from "../../generated/prisma/client.js";

const sprDataSchema = z.object({
  /** What the approver's limit is set against. Read here, never from a request. */
  amount: decimalStringSchema,
  /** Who raised it, so they can never decide it. */
  requesterUserId: z.uuid(),
  decision: z
    .object({
      outcome: z.enum(SPR_DECISIONS),
      by: z.string().min(1),
      /** Who decided, so only they may undo it. Optional: older rows have none. */
      byUserId: z.uuid().optional(),
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
const AWAITING_SPR = "AwaitingSpr" satisfies OrderStatus;

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

  /** Every SPR the workflow runs whose order is waiting for its decision. */
  async awaitingDecision(): Promise<StoredSpr[]> {
    const rows = await this.database.client.workflowRecord.findMany({
      where: { recordType: SPR_TYPE, instance: { status: AWAITING_SPR } },
      select: {
        id: true,
        data: true,
        updatedAt: true,
        instance: { select: { orderRef: true } },
      },
    });
    return rows.flatMap((row) => {
      // One damaged record must not empty everyone's inbox. Deciding it still
      // fails loudly, through findByOrder.
      const data = sprDataSchema.safeParse(row.data);
      return row.instance && data.success && !data.data.decision
        ? [
            {
              ...data.data,
              id: row.id,
              orderRef: row.instance.orderRef,
              updatedAt: row.updatedAt,
            },
          ]
        : [];
    });
  }

  /**
   * The orders among these whose SPR is finished with as far as its approver goes:
   * decided, or passed on and no longer waiting. A passed-on SPR on a waiting order
   * is the routing's to place, because it comes back if nobody above can act.
   */
  async settled(orderRefs: readonly string[]): Promise<ReadonlySet<string>> {
    if (orderRefs.length === 0) return new Set();
    const rows = await this.database.client.workflowRecord.findMany({
      where: {
        recordType: SPR_TYPE,
        instance: { orderRef: { in: [...orderRefs] } },
      },
      select: {
        data: true,
        instance: { select: { orderRef: true, status: true } },
      },
    });
    return new Set(
      rows.flatMap((row) => {
        const data = sprDataSchema.safeParse(row.data);
        return row.instance &&
          data.success &&
          (data.data.decision ||
            (data.data.passedOn && row.instance.status !== AWAITING_SPR))
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

  /**
   * Gives a suggested SPR its data, which is what raising it means: from now on
   * it has a requester, an amount to judge and room for a decision. A suggestion
   * can be raised, and so can an SPR the approvers rejected, once it is corrected;
   * one that waits for a decision or was approved cannot.
   */
  async raise(
    orderRef: string,
    data: Pick<SprData, "amount" | "requesterUserId">,
  ): Promise<void> {
    const row = await this.database.client.workflowRecord.findFirst({
      where: { recordType: SPR_TYPE, instance: { orderRef } },
      select: { id: true, data: true },
    });
    if (!row) throw new NotFoundError(`An SPR for ${orderRef}`);
    const stored = row.data === null ? null : sprDataSchema.parse(row.data);
    if (stored && stored.decision?.outcome !== "rejected") {
      throw new ConflictError("This request has already been raised.");
    }
    await this.database.client.workflowRecord.update({
      where: { id: row.id },
      data: { data: { ...data, decision: null, passedOn: null } },
    });
  }

  /** Takes a raise back: the SPR is a suggestion again, with no data, while nobody has decided it. */
  async withdraw(orderRef: string): Promise<void> {
    await this.database.client.workflowRecord.updateMany({
      where: { recordType: SPR_TYPE, instance: { orderRef } },
      data: { data: Prisma.DbNull },
    });
  }
}
