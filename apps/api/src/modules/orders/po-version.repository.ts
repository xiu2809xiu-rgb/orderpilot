import { Inject, Injectable } from "@nestjs/common";
import type { OrderCaptureState } from "@orderpilot/shared";
import { Prisma } from "../../generated/prisma/client.js";
import type { OrderCaptureState as RowCaptureState } from "../../generated/prisma/enums.js";
import { Database } from "../../database/database.js";
import type { PoVersionContent } from "./domain/po-version-content.js";
import type { SalesOrder } from "./domain/sales-order.js";
import { SalesOrderRepository } from "./sales-order.repository.js";

/** One version of a stored order, the current one or a copy. */
export interface StoredPoVersion {
  readonly poVersionNo: number;
  readonly current: boolean;
  readonly content: PoVersionContent;
  /** When this version became the order's content, and by whom (a plain user id). */
  readonly arrivedAt: Date;
  readonly arrivedBy: string;
  readonly supersededAt: Date | null;
  readonly supersededBy: string | null;
}

export interface PoVersionHistory {
  readonly orderNo: string;
  readonly captureState: OrderCaptureState;
  /** Ascending: the last one is the current version. */
  readonly versions: readonly StoredPoVersion[];
}

const WITH_VERSIONS = {
  lines: { orderBy: { lineNo: "asc" } },
  poVersions: {
    orderBy: { poVersionNo: "asc" },
    include: { lines: { orderBy: { lineNo: "asc" } } },
  },
} satisfies Prisma.SalesOrderInclude;

type HistoryRow = Prisma.SalesOrderGetPayload<{
  include: typeof WITH_VERSIONS;
}>;
type LineRow = HistoryRow["lines"][number];

const FROM_ROW: Record<RowCaptureState, OrderCaptureState> = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  VOID: "void",
};

const day = (value: Date): string => value.toISOString().slice(0, 10);

function lineOf(
  line: Pick<
    LineRow,
    "lineNo" | "itemNo" | "description" | "quantity" | "unitPrice" | "qtyToShip"
  >,
): PoVersionContent["lines"][number] {
  return {
    lineNo: line.lineNo,
    itemNo: line.itemNo,
    description: line.description,
    quantity: line.quantity.toFixed(3),
    unitPrice: line.unitPrice.toFixed(2),
    qtyToShip: line.qtyToShip.toFixed(3),
  };
}

/**
 * A failed write is rethrown with only the order, the version and the Prisma
 * code. Prisma's own message can quote the arguments of the failed call, and
 * those hold prices, which never reach a log or an answer (ADR 0074 decision
 * 10). It is a plain Error on purpose: the exception filter gives the caller
 * only the standard internal error.
 */
function couldNotStore(
  orderNo: string,
  poVersionNo: number,
  error: unknown,
): Error {
  const code =
    error instanceof Prisma.PrismaClientKnownRequestError
      ? error.code
      : "unknown";
  return new Error(
    `PO version ${String(poVersionNo)} of order ${orderNo} could not be stored (${code})`,
  );
}

/**
 * The only place the PO version tables are read or written, and the second
 * place (after `SalesOrderRepository`) that writes the order tables: the lock,
 * the copy and the move are one operation and live together, so P-50's edits
 * to the order repository do not collide with them.
 */
@Injectable()
export class PoVersionRepository {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(SalesOrderRepository) private readonly orders: SalesOrderRepository,
  ) {}

  /**
   * The order as its current PO version, read so that it is one version's
   * content. Null for an unknown number or a sample.
   */
  async headOf(orderNo: string): Promise<SalesOrder | null> {
    return this.stable(orderNo, async () => {
      const head = await this.orders.findByNo(orderNo);
      return head ? { value: head, poVersionNo: head.poVersionNo } : null;
    });
  }

  /**
   * Moves the order to `next`'s content as its next PO version, and keeps what
   * it held as a copy. In one transaction (it joins the caller's): lock the row
   * where the number and the state match, read the locked row, insert the copy,
   * move the head with the guard repeated in its WHERE, and replace the lines.
   * False means the guard refused and nothing changed.
   */
  supersede(
    next: SalesOrder,
    expectedPoVersionNo: number,
    by: { userId: string; at: Date },
  ): Promise<boolean> {
    return this.database.transaction(async () => {
      const client = this.database.client;
      const locked = await client.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "SalesOrder"
        WHERE "orderNo" = ${next.orderNo}
          AND "poVersionNo" = ${expectedPoVersionNo}
          AND "captureState" = 'SUBMITTED'
        FOR UPDATE`;
      const id = locked[0]?.id;
      if (id === undefined) return false;
      try {
        const head = await client.salesOrder.findUniqueOrThrow({
          where: { id },
          include: { lines: { orderBy: { lineNo: "asc" } } },
        });
        await client.salesOrderPoVersion.create({
          data: {
            orderId: id,
            poVersionNo: head.poVersionNo,
            orderDate: head.orderDate,
            shipmentDate: head.shipmentDate,
            currencyCode: head.currencyCode,
            prepaymentPercent: head.prepaymentPercent,
            supersededAt: by.at,
            supersededBy: by.userId,
            lines: {
              create: head.lines.map((line) => ({
                lineNo: line.lineNo,
                itemNo: line.itemNo,
                description: line.description,
                quantity: line.quantity,
                unitPrice: line.unitPrice,
                qtyToShip: line.qtyToShip,
              })),
            },
          },
        });
        // Never the customer, the PO number, the currency or the state: a
        // revision keeps the order. `version` moves with the number, so a
        // guard written on it can never win over a revision.
        const { count } = await client.salesOrder.updateMany({
          where: { id, poVersionNo: expectedPoVersionNo },
          data: {
            orderDate: new Date(`${next.orderDate}T00:00:00.000Z`),
            shipmentDate: next.shipmentDate
              ? new Date(`${next.shipmentDate}T00:00:00.000Z`)
              : null,
            prepaymentPercent: next.prepaymentPercent,
            poVersionNo: { increment: 1 },
            version: { increment: 1 },
          },
        });
        if (count !== 1)
          throw new Error("The guarded move changed no row or more than one");
        await client.salesOrderLine.deleteMany({ where: { orderId: id } });
        await client.salesOrderLine.createMany({
          data: next.lines.map((line) => ({
            orderId: id,
            lineNo: line.lineNo,
            itemNo: line.itemNo,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            qtyToShip: line.qtyToShip,
          })),
        });
        return true;
      } catch (error) {
        throw couldNotStore(next.orderNo, expectedPoVersionNo + 1, error);
      }
    });
  }

  /**
   * Every version of a stored order, whatever its capture state: the service
   * decides what to say of a draft. Null for an unknown number or a sample.
   */
  async historyOf(orderNo: string): Promise<PoVersionHistory | null> {
    return this.stable(orderNo, async () => {
      const row = await this.database.client.salesOrder.findUnique({
        where: { orderNo },
        include: WITH_VERSIONS,
      });
      if (!row) return null;
      return { value: historyFrom(row), poVersionNo: row.poVersionNo };
    });
  }

  /**
   * Reads, then reads the number again. The number only grows, so equal
   * numbers prove that no revision committed between the statements, and a
   * header of one version is never joined to the lines of the next. On a
   * difference it reads once more, then gives up loudly.
   */
  private async stable<T>(
    orderNo: string,
    read: () => Promise<{ value: T; poVersionNo: number } | null>,
  ): Promise<T | null> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const first = await read();
      if (first === null) return null;
      await this.afterRead();
      const rows = await this.database.client.$queryRaw<
        { poVersionNo: number }[]
      >`SELECT "poVersionNo" FROM "SalesOrder" WHERE "orderNo" = ${orderNo}`;
      if (rows[0]?.poVersionNo === first.poVersionNo) return first.value;
    }
    throw new Error(
      `The PO version of order ${orderNo} kept moving while it was read`,
    );
  }

  /** A seam for a test to commit a revision between the two statements. It does nothing. */
  protected afterRead(): Promise<void> {
    return Promise.resolve();
  }
}

function historyFrom(row: HistoryRow): PoVersionHistory {
  const copies = row.poVersions;
  // The deferred constraint trigger guarantees this at commit, so a miss is a
  // broken table and says so rather than drawing a history with a hole.
  if (
    copies.length !== row.poVersionNo - 1 ||
    copies.some((copy, index) => copy.poVersionNo !== index + 1)
  )
    throw new Error(
      `Order ${row.orderNo} is at PO version ${String(row.poVersionNo)} but holds ${String(copies.length)} earlier copies`,
    );
  const arrival = (poVersionNo: number) => {
    const before = copies[poVersionNo - 2];
    return before
      ? { at: before.supersededAt, by: before.supersededBy }
      : { at: row.createdAt, by: row.createdBy };
  };
  const versions: StoredPoVersion[] = copies.map((copy) => ({
    poVersionNo: copy.poVersionNo,
    current: false,
    content: {
      orderDate: day(copy.orderDate),
      shipmentDate: copy.shipmentDate ? day(copy.shipmentDate) : null,
      currencyCode: copy.currencyCode,
      prepaymentPercent: copy.prepaymentPercent.toFixed(2),
      lines: copy.lines.map(lineOf),
    },
    arrivedAt: arrival(copy.poVersionNo).at,
    arrivedBy: arrival(copy.poVersionNo).by,
    supersededAt: copy.supersededAt,
    supersededBy: copy.supersededBy,
  }));
  versions.push({
    poVersionNo: row.poVersionNo,
    current: true,
    content: {
      orderDate: day(row.orderDate),
      shipmentDate: row.shipmentDate ? day(row.shipmentDate) : null,
      currencyCode: row.currencyCode,
      prepaymentPercent: row.prepaymentPercent.toFixed(2),
      lines: row.lines.map(lineOf),
    },
    arrivedAt: arrival(row.poVersionNo).at,
    arrivedBy: arrival(row.poVersionNo).by,
    supersededAt: null,
    supersededBy: null,
  });
  return {
    orderNo: row.orderNo,
    captureState: FROM_ROW[row.captureState],
    versions,
  };
}
