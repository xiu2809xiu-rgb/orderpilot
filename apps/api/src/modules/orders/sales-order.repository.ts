import { Inject, Injectable } from "@nestjs/common";
import type { OrderCaptureState } from "@orderpilot/shared";
import { Prisma } from "../../generated/prisma/client.js";
import type { OrderCaptureState as RowCaptureState } from "../../generated/prisma/enums.js";
import { Database } from "../../database/database.js";
import { OrderConflictError } from "./domain/order-errors.js";
import { SalesOrder } from "./domain/sales-order.js";

/**
 * The most stored orders one read takes. The list merges them with the samples
 * in memory (ADR 0046), so past this the plan is a keyset page in SQL, and
 * until then a read that hits the bound fails loudly instead of cutting the
 * list short. The failure is a plain Error on purpose: the exception filter
 * logs its message against the trace id and gives the caller only the standard
 * internal error, so no internal limit reaches a client.
 */
export const MAX_STORED_READ = 2000;

const WITH_LINES = {
  lines: { orderBy: { lineNo: "asc" } },
} satisfies Prisma.SalesOrderInclude;

type Row = Prisma.SalesOrderGetPayload<{ include: typeof WITH_LINES }>;

// The column is upper case, as the other enums are; the contract is lower case.
const FROM_ROW: Record<RowCaptureState, OrderCaptureState> = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  VOID: "void",
};
const TO_ROW: Record<OrderCaptureState, RowCaptureState> = {
  draft: "DRAFT",
  submitted: "SUBMITTED",
  void: "VOID",
};

const day = (value: Date): string => value.toISOString().slice(0, 10);
const asDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`);

function toDomain(row: Row): SalesOrder {
  return new SalesOrder({
    orderNo: row.orderNo,
    navisionNo: row.navisionNo,
    captureState: FROM_ROW[row.captureState],
    customerNo: row.customerNo,
    externalDocumentNo: row.externalDocumentNo,
    orderDate: day(row.orderDate),
    shipmentDate: row.shipmentDate ? day(row.shipmentDate) : null,
    currencyCode: row.currencyCode,
    prepaymentPercent: row.prepaymentPercent.toFixed(2),
    createdBy: row.createdBy,
    version: row.version,
    lines: row.lines.map((line) => ({
      lineNo: line.lineNo,
      itemNo: line.itemNo,
      description: line.description,
      quantity: line.quantity.toFixed(3),
      unitPrice: line.unitPrice.toFixed(2),
      qtyToShip: line.qtyToShip.toFixed(3),
    })),
  });
}

/**
 * A unique key said no: the order number, or the live customer and PO pair.
 * Which one is the service's to judge once the transaction has ended, so
 * nothing here reads `meta.target`.
 */
function asConflict(error: unknown, order: SalesOrder): unknown {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    return new OrderConflictError(
      `Order ${order.orderNo} conflicts with one already stored.`,
    );
  return error;
}

/** The only place the sales order tables are read or written. */
@Injectable()
export class SalesOrderRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async insert(order: SalesOrder): Promise<SalesOrder> {
    try {
      const row = await this.database.client.salesOrder.create({
        data: {
          orderNo: order.orderNo,
          navisionNo: order.navisionNo,
          captureState: TO_ROW[order.captureState],
          customerNo: order.customerNo,
          externalDocumentNo: order.externalDocumentNo,
          orderDate: asDate(order.orderDate),
          shipmentDate: order.shipmentDate ? asDate(order.shipmentDate) : null,
          currencyCode: order.currencyCode,
          prepaymentPercent: order.prepaymentPercent,
          createdBy: order.createdBy,
          lines: {
            create: order.lines.map((line) => ({
              lineNo: line.lineNo,
              itemNo: line.itemNo,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              qtyToShip: line.qtyToShip,
            })),
          },
        },
        include: WITH_LINES,
      });
      return toDomain(row);
    } catch (error) {
      throw asConflict(error, order);
    }
  }

  /**
   * Saves a draft's header and lines, but only if nobody saved it since the
   * caller read `expectedVersion`, and only while it is still a draft. False
   * means the guard refused and nothing changed; the caller re-reads to say why.
   */
  update(order: SalesOrder, expectedVersion: number): Promise<boolean> {
    return this.database.transaction(async () => {
      const client = this.database.client;
      try {
        const { count } = await client.salesOrder.updateMany({
          where: {
            orderNo: order.orderNo,
            version: expectedVersion,
            captureState: "DRAFT",
          },
          data: {
            customerNo: order.customerNo,
            externalDocumentNo: order.externalDocumentNo,
            orderDate: asDate(order.orderDate),
            shipmentDate: order.shipmentDate
              ? asDate(order.shipmentDate)
              : null,
            prepaymentPercent: order.prepaymentPercent,
            version: { increment: 1 },
          },
        });
        if (count === 0) return false;
        const { id } = await client.salesOrder.findUniqueOrThrow({
          where: { orderNo: order.orderNo },
          select: { id: true },
        });
        await client.salesOrderLine.deleteMany({ where: { orderId: id } });
        await client.salesOrderLine.createMany({
          data: order.lines.map((line) => ({
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
        throw asConflict(error, order);
      }
    });
  }

  /** Closes a draft under the same guard as `update`. False means it refused. */
  async markVoid(orderNo: string, expectedVersion: number): Promise<boolean> {
    const { count } = await this.database.client.salesOrder.updateMany({
      where: { orderNo, version: expectedVersion, captureState: "DRAFT" },
      data: { captureState: "VOID", version: { increment: 1 } },
    });
    return count > 0;
  }

  /**
   * The number of the live order that holds this customer and PO number, or
   * null. It uses the index's own expression: `mode: "insensitive"` would
   * compile to ILIKE, where `_` and `%` in a PO number are wildcards.
   */
  async findLiveByPo(
    customerNo: string,
    po: string,
    exceptOrderNo?: string,
  ): Promise<string | null> {
    const except = exceptOrderNo ?? null;
    const rows = await this.database.client.$queryRaw<{ orderNo: string }[]>`
      SELECT "orderNo" FROM "SalesOrder"
      WHERE "customerNo" = ${customerNo}
        AND upper("externalDocumentNo") = upper(${po})
        AND "captureState" <> 'VOID'
        AND (${except}::text IS NULL OR "orderNo" <> ${except}::text)
      LIMIT 1`;
    return rows[0]?.orderNo ?? null;
  }

  async findByNo(orderNo: string): Promise<SalesOrder | null> {
    const row = await this.database.client.salesOrder.findUnique({
      where: { orderNo },
      include: WITH_LINES,
    });
    return row ? toDomain(row) : null;
  }

  /** Every stored order, oldest number first, within the bound. */
  async listAll(): Promise<readonly SalesOrder[]> {
    const rows = await this.database.client.salesOrder.findMany({
      include: WITH_LINES,
      orderBy: { orderNo: "asc" },
      take: MAX_STORED_READ + 1,
    });
    if (rows.length > MAX_STORED_READ)
      throw new Error(
        `More than ${String(MAX_STORED_READ)} stored orders: the list needs a page in SQL before it can grow.`,
      );
    return rows.map(toDomain);
  }

  countAll(): Promise<number> {
    return this.database.client.salesOrder.count();
  }
}
