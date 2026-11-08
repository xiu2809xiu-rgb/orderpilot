import { Inject, Injectable } from "@nestjs/common";
import type {
  CreateSalesOrderBody,
  PatchSalesOrderBody,
  SalesOrderDetail,
  VoidSalesOrderBody,
} from "@orderpilot/shared";
import type { AuthUser } from "../../auth/auth-context.js";
import { AuditService } from "../../audit/audit.service.js";
import {
  ConflictError,
  NotFoundError,
  ValidationFailedError,
} from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { CustomerLookup } from "../master-data/customer-lookup.js";
import { ItemLookup } from "../master-data/item-lookup.js";
import { draftLines } from "./domain/draft-lines.js";
import { OrderMasking } from "./domain/order-masking.js";
import {
  DuplicateOrderError,
  OrderConflictError,
} from "./domain/order-errors.js";
import { normalisePoNumber } from "./domain/po-number.js";
import { SalesOrder, type SalesOrderChanges } from "./domain/sales-order.js";
import { OrderNumberAllocator } from "./order-number.allocator.js";
import { OrdersService } from "./orders.service.js";
import { SalesOrderRepository } from "./sales-order.repository.js";

export type OrderWriter = AuthUser;

/** Where a write came from, so its audit event leads back to the request. */
export interface WriteInfo {
  readonly ip: string | null;
  readonly traceId: string;
}

const STALE = "This order was changed by someone else. Reload it to see it.";

/**
 * Creates, changes and voids draft orders (ADR 0047). A person's click is the
 * only trigger: nothing here submits an order or posts to Navision. The route's
 * permission guard has already decided who may call; the guard audits its own
 * refusals, so nothing here asks the policy again.
 *
 * Duplicates are decided by the unique index, not by a read: the read only
 * gives a friendly answer early. When two requests race, the index refuses the
 * second, and the catch outside the transaction (Postgres has aborted it, so no
 * query can run inside) names the order that won.
 */
@Injectable()
export class OrdersWriteService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(SalesOrderRepository)
    private readonly repository: SalesOrderRepository,
    @Inject(OrderNumberAllocator)
    private readonly numbers: OrderNumberAllocator,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CustomerLookup) private readonly customers: CustomerLookup,
    @Inject(ItemLookup) private readonly items: ItemLookup,
    @Inject(OrderMasking) private readonly masking: OrderMasking,
    @Inject(OrdersService) private readonly orders: OrdersService,
  ) {}

  async create(
    body: CreateSalesOrderBody,
    actor: OrderWriter,
    info: WriteInfo,
  ): Promise<SalesOrderDetail> {
    const po = normalisePoNumber(body.externalDocumentNo);
    await this.requireCustomer(body.customerNo);
    const lines = draftLines(body, {
      items: await this.items.detailsOf(body.lines.map((l) => l.itemNo)),
      canSeePrice: this.masking.canSeeAmount(actor.role),
      stored: [],
    });
    await this.refuseDuplicate(body.customerNo, po);
    try {
      const orderNo = await this.database.transaction(async () => {
        const no = await this.numbers.next();
        const order = await this.repository.insert(
          new SalesOrder({
            orderNo: no,
            navisionNo: null,
            captureState: "draft",
            customerNo: body.customerNo,
            externalDocumentNo: po,
            orderDate: body.orderDate,
            shipmentDate: body.shipmentDate,
            currencyCode: "USD",
            prepaymentPercent: body.prepaymentPercent,
            createdBy: actor.id,
            lines,
          }),
        );
        await this.audit.record({
          actor: { kind: "user", userId: actor.id, role: actor.role },
          action: "order.created",
          entityType: "Order",
          entityId: order.orderNo,
          summary: `${actor.displayName} created draft order ${order.orderNo}`,
          changes: {
            customerNo: order.customerNo,
            externalDocumentNo: order.externalDocumentNo,
            lines: order.lines.length,
          },
          ip: info.ip,
          traceId: info.traceId,
        });
        return order.orderNo;
      });
      return await this.orders.one(orderNo, actor.role);
    } catch (error) {
      throw await this.nameTheWinner(error, body.customerNo, po);
    }
  }

  async update(
    orderNo: string,
    body: PatchSalesOrderBody,
    actor: OrderWriter,
    info: WriteInfo,
  ): Promise<SalesOrderDetail> {
    const stored = await this.requireOrder(orderNo);
    // The draft rule first: a closed order is never "changed by someone else".
    stored.requireDraft("changed");
    if (stored.version !== body.version) throw new ConflictError(STALE);
    const { version, ...sent } = body;
    const po =
      sent.externalDocumentNo === undefined
        ? undefined
        : normalisePoNumber(sent.externalDocumentNo);
    if (sent.customerNo !== undefined)
      await this.requireCustomer(sent.customerNo);
    const lines =
      sent.lines === undefined
        ? undefined
        : draftLines(
            { lines: sent.lines },
            {
              items: await this.items.detailsOf(
                sent.lines.map((l) => l.itemNo),
              ),
              canSeePrice: this.masking.canSeeAmount(actor.role),
              stored: stored.lines.map((l) => l.toFacts()),
            },
          );
    const changes: SalesOrderChanges = {
      customerNo: sent.customerNo,
      externalDocumentNo: po,
      orderDate: sent.orderDate,
      shipmentDate: sent.shipmentDate,
      prepaymentPercent: sent.prepaymentPercent,
      lines,
    };
    const edited = stored.edit(changes);
    // A lines-only edit cannot make a duplicate; the index still decides a race.
    if (
      edited.customerNo !== stored.customerNo ||
      edited.externalDocumentNo !== stored.externalDocumentNo
    )
      await this.refuseDuplicate(
        edited.customerNo,
        edited.externalDocumentNo,
        orderNo,
      );
    try {
      const saved = await this.database.transaction(async () => {
        if (!(await this.repository.update(edited, version))) return false;
        await this.audit.record({
          actor: { kind: "user", userId: actor.id, role: actor.role },
          action: "order.updated",
          entityType: "Order",
          entityId: orderNo,
          summary: `${actor.displayName} changed draft order ${orderNo}`,
          changes: {
            fields: Object.keys(sent),
            ...(lines ? { lines: lines.length } : {}),
            version: { from: version, to: version + 1 },
          },
          ip: info.ip,
          traceId: info.traceId,
        });
        return true;
      });
      if (!saved) throw await this.whyRefused(orderNo);
      return await this.orders.one(orderNo, actor.role);
    } catch (error) {
      throw await this.nameTheWinner(
        error,
        edited.customerNo,
        edited.externalDocumentNo,
        orderNo,
      );
    }
  }

  async voidDraft(
    orderNo: string,
    body: VoidSalesOrderBody,
    actor: OrderWriter,
    info: WriteInfo,
  ): Promise<SalesOrderDetail> {
    const stored = await this.requireOrder(orderNo);
    stored.requireDraft("voided");
    if (stored.version !== body.version) throw new ConflictError(STALE);
    const done = await this.database.transaction(async () => {
      if (!(await this.repository.markVoid(orderNo, body.version)))
        return false;
      await this.audit.record({
        actor: { kind: "user", userId: actor.id, role: actor.role },
        action: "order.voided",
        entityType: "Order",
        entityId: orderNo,
        summary: `${actor.displayName} voided draft order ${orderNo}`,
        changes: {
          reason: body.reason,
          version: { from: body.version, to: body.version + 1 },
        },
        ip: info.ip,
        traceId: info.traceId,
      });
      return true;
    });
    if (!done) throw await this.whyRefused(orderNo);
    return this.orders.one(orderNo, actor.role);
  }

  private async requireOrder(orderNo: string): Promise<SalesOrder> {
    // A sample is not stored, so it answers 404 here like any unknown number.
    const stored = await this.repository.findByNo(orderNo);
    if (!stored) throw new NotFoundError("Order");
    return stored;
  }

  private async requireCustomer(customerNo: string): Promise<void> {
    if ((await this.customers.namesOf([customerNo])).has(customerNo)) return;
    throw new ValidationFailedError([
      { path: "customerNo", message: "No customer has this Navision number." },
    ]);
  }

  private async refuseDuplicate(
    customerNo: string,
    po: string,
    exceptOrderNo?: string,
  ): Promise<void> {
    const live = await this.repository.findLiveByPo(
      customerNo,
      po,
      exceptOrderNo,
    );
    if (live) throw new DuplicateOrderError(po, live);
  }

  /** The guarded update said no: the order is no longer a draft, or someone saved first. */
  private async whyRefused(orderNo: string): Promise<ConflictError> {
    const now = await this.repository.findByNo(orderNo);
    if (now && !now.isDraft)
      return new ConflictError(
        `Order ${orderNo} is ${now.captureState}, so it cannot be changed. Only a draft can.`,
      );
    return new ConflictError(STALE);
  }

  /**
   * A refusal by the unique index becomes the duplicate answer when a live
   * order holds the pair now. Anything else is rethrown unchanged.
   */
  private async nameTheWinner(
    error: unknown,
    customerNo: string,
    po: string,
    exceptOrderNo?: string,
  ): Promise<unknown> {
    if (!(error instanceof OrderConflictError)) return error;
    const live = await this.repository.findLiveByPo(
      customerNo,
      po,
      exceptOrderNo,
    );
    return live ? new DuplicateOrderError(po, live) : error;
  }
}
