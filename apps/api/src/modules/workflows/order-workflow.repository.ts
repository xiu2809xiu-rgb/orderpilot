import { Inject, Injectable } from "@nestjs/common";
import { decimalStringSchema, orderStatusSchema } from "@orderpilot/shared";
import { z } from "zod";
import { ConflictError, NotFoundError } from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import {
  type OrderEvent,
  type OrderSnapshot,
  type OrderTransitionResult,
} from "./domain/order-state-machine.js";
import { SALES_FLOW_KEY, SALES_FLOW_VERSION } from "./domain/sales-flow.js";

const factsSchema = z.object({
  prepaymentDue: decimalStringSchema.nullable(),
  stockCoversOrder: z.boolean().nullable(),
  holds: z.array(z.string().min(1)),
  resumeTo: orderStatusSchema.nullable(),
  enteredAt: z.iso.datetime(),
});

export interface StoredOrder {
  readonly id: string;
  /** Counts writes, so two commands on one order never both win. */
  readonly version: number;
  /** Null for a seeded sample: its status is a label the machine never set. */
  readonly state: OrderSnapshot | null;
}

/** The only code that writes a workflow instance's status, apart from the demo seed's labels. */
@Injectable()
export class OrderWorkflowRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async find(orderRef: string): Promise<StoredOrder | null> {
    const [found] = await this.findMany([orderRef]);
    return found?.stored ?? null;
  }

  /** False when this event is already there. The key is unique per order. */
  async recordTaskEvent(event: NewTaskEvent): Promise<boolean> {
    const { count } = await this.database.client.workflowEvent.createMany({
      data: [
        {
          instanceId: event.instanceId,
          type: event.type,
          actorKind: "system",
          actorName: event.actorName,
          summary: event.summary,
          data: event.data,
          idempotencyKey: event.key,
          occurredAt: event.occurredAt,
        },
      ],
      skipDuplicates: true,
    });
    return count === 1;
  }

  /** One read for many orders, because the tracker asks about a whole page at once. */
  async findMany(
    orderRefs: readonly string[],
  ): Promise<{ readonly orderRef: string; readonly stored: StoredOrder }[]> {
    const rows = await this.database.client.workflowInstance.findMany({
      where: {
        orderRef: { in: [...orderRefs] },
        definition: { key: SALES_FLOW_KEY },
      },
      select: {
        id: true,
        orderRef: true,
        version: true,
        status: true,
        facts: true,
      },
    });
    return rows.map((row) => ({
      orderRef: row.orderRef,
      stored: {
        id: row.id,
        version: row.version,
        state: stateOf(row),
      },
    }));
  }

  /** Stores a new order's first state and event. Starting one twice is refused by the unique key. */
  async insert(
    orderRef: string,
    { state, event, currentStep }: OrderTransitionResult,
  ): Promise<void> {
    const definition = await this.database.client.workflowDefinition.findUnique(
      {
        where: {
          key_version: { key: SALES_FLOW_KEY, version: SALES_FLOW_VERSION },
        },
        select: { id: true },
      },
    );
    if (!definition) throw new NotFoundError("The sales flow's definition");
    try {
      const { id } = await this.database.client.workflowInstance.create({
        data: {
          definitionId: definition.id,
          orderRef,
          status: state.status,
          currentStep,
          facts: factsOf(state),
          startedAt: event.at,
        },
        select: { id: true },
      });
      await this.insertEvent(id, orderRef, event);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(`Order ${orderRef} has already started.`);
      }
      throw error;
    }
  }

  /**
   * Writes the next state and its event, only if nobody has moved the order
   * since it was read. False when someone has, with nothing written.
   */
  async saveTransition(
    stored: Pick<StoredOrder, "id" | "version">,
    orderRef: string,
    { state, event, currentStep }: OrderTransitionResult,
  ): Promise<boolean> {
    const { count } = await this.database.client.workflowInstance.updateMany({
      where: { id: stored.id, version: stored.version },
      data: {
        status: state.status,
        currentStep,
        facts: factsOf(state),
        version: { increment: 1 },
        completedAt:
          state.status === "Closed" || state.status === "Cancelled"
            ? event.at
            : null,
      },
    });
    if (count === 0) return false;
    await this.insertEvent(stored.id, orderRef, event);
    return true;
  }

  private async insertEvent(
    instanceId: string,
    orderRef: string,
    event: OrderEvent,
  ): Promise<void> {
    const data = {
      ...event.data,
      ...(event.reason === null ? {} : { reason: event.reason }),
    };
    await this.database.client.workflowEvent.create({
      data: {
        instanceId,
        type: event.type,
        fromStatus: event.from,
        toStatus: event.to,
        actorKind: event.actor.kind,
        actorUserId: event.actor.kind === "user" ? event.actor.userId : null,
        actorName: event.actor.name,
        summary: `${event.actor.name}: ${event.type} on ${orderRef}, ${event.from ?? "new"} to ${event.to}`,
        data: Object.keys(data).length > 0 ? data : Prisma.JsonNull,
        occurredAt: event.at,
      },
    });
  }
}

export interface NewTaskEvent {
  readonly key: string;
  readonly type: string;
  readonly instanceId: string;
  readonly actorName: string;
  readonly summary: string;
  readonly data: Prisma.InputJsonObject;
  readonly occurredAt: Date;
}

/**
 * A seeded sample has a label for a status and no facts, so it is not the
 * machine's to run. Facts that do not parse are a different thing, damage on a
 * real order, and must fail loudly rather than pass the order off as a sample.
 */
function stateOf(row: {
  readonly status: string;
  readonly facts: unknown;
}): OrderSnapshot | null {
  const status = orderStatusSchema.safeParse(row.status);
  if (!status.success || row.facts === null) return null;
  return { status: status.data, ...factsSchema.parse(row.facts) };
}

function factsOf(state: OrderSnapshot): Prisma.InputJsonObject {
  return {
    prepaymentDue: state.prepaymentDue,
    stockCoversOrder: state.stockCoversOrder,
    holds: [...state.holds],
    resumeTo: state.resumeTo,
    enteredAt: state.enteredAt,
  };
}
