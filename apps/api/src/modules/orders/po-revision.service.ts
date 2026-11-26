import { Inject, Injectable } from "@nestjs/common";
import {
  PO_VERSION_STALE_PATH,
  type ConfirmPoVersionBody,
  type CreateSalesOrderBody,
  type PoVersionConfirmedView,
  type PoVersionDifferences,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import {
  DomainError,
  NotFoundError,
  ValidationFailedError,
} from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import { CustomerLookup } from "../master-data/customer-lookup.js";
import { ItemLookup } from "../master-data/item-lookup.js";
import { draftLines } from "./domain/draft-lines.js";
import { handOver } from "./domain/hand-over.js";
import { HandoffRefusedError } from "./domain/order-errors.js";
import { OrderHandoff, type HandoffEffect } from "./domain/order-handoff.js";
import { OrderMasking } from "./domain/order-masking.js";
import {
  contentOf,
  padDecimal,
  type NumberedPoVersionContent,
} from "./domain/po-version-content.js";
import { PoVersionDiff } from "./domain/po-version-diff.js";
import { poVersionFact } from "./domain/po-version-fact.js";
import { toDifferencesView } from "./domain/po-version-view.js";
import type { SalesOrder } from "./domain/sales-order.js";
import type { OrderWriter, WriteInfo } from "./orders-write.service.js";
import { OrdersService } from "./orders.service.js";
import { PoVersionRepository } from "./po-version.repository.js";

interface Prepared {
  readonly stored: SalesOrder;
  readonly revised: SalesOrder;
  /** Built with prices compared. Used for the identical refusal and the audit counts, never for an answer. */
  readonly full: PoVersionDiff;
}

const numbered = (order: SalesOrder): NumberedPoVersionContent => ({
  ...contentOf(order),
  poVersionNo: order.poVersionNo,
});

/**
 * Previews and confirms a revised PO of a submitted order (ADR 0074). A
 * person's confirmation is the only trigger. Confirming moves the order to its
 * next PO version and tells area 2 through OrderHandoff, inside one
 * transaction, and posts nothing to Business Central. The route's permission
 * guard has already decided who may call.
 *
 * The answers hold no price a role may not see: every difference is built by
 * `toDifferencesView` from two contents and the role, and nothing here passes
 * it a diff. No price goes to an audit row either.
 */
@Injectable()
export class PoRevisionService {
  constructor(
    @Inject(Database) private readonly database: Database,
    @Inject(PoVersionRepository)
    private readonly poVersions: PoVersionRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(CustomerLookup) private readonly customers: CustomerLookup,
    @Inject(ItemLookup) private readonly items: ItemLookup,
    @Inject(OrderMasking) private readonly masking: OrderMasking,
    @Inject(OrdersService) private readonly orders: OrdersService,
    @Inject(OrderHandoff) private readonly handoff: OrderHandoff,
  ) {}

  /** The differences a revised PO would make. Writes nothing and calls no port. */
  async preview(
    orderNo: string,
    body: CreateSalesOrderBody,
    actor: OrderWriter,
  ): Promise<PoVersionDifferences> {
    const { stored, revised } = await this.prepare(orderNo, body, actor);
    return toDifferencesView(
      numbered(stored),
      numbered(revised),
      this.masking,
      actor.role,
    );
  }

  /**
   * One transaction, in this order: lock and move the order (the guard), hand
   * the fact to area 2, write the audit row. A refusal from area 2 rolls all of
   * it back, so its own audit row is written afterwards, in a transaction of
   * its own, with the code and never the words.
   */
  async confirm(
    orderNo: string,
    body: ConfirmPoVersionBody,
    actor: OrderWriter,
    info: WriteInfo,
    now: Date = new Date(),
  ): Promise<PoVersionConfirmedView> {
    const expected = body.expectedPoVersionNo;
    const { stored, revised, full } = await this.prepare(
      orderNo,
      body,
      actor,
      expected,
    );
    if (full.identical)
      throw new ValidationFailedError([
        {
          path: "revision",
          message: `This PO has the same dates, quantities and prices as PO version ${String(stored.poVersionNo)}, so there is nothing to confirm. Descriptions are not compared.`,
        },
      ]);
    const fact = poVersionFact(
      stored,
      revised,
      { userId: actor.id, name: actor.displayName, role: actor.role },
      now,
      info,
    );
    const actorOf = {
      kind: "user",
      userId: actor.id,
      role: actor.role,
    } as const;
    let outcome: { done: false } | { done: true; effect: HandoffEffect };
    try {
      outcome = await this.database.transaction(async () => {
        if (
          !(await this.poVersions.supersede(revised, expected, {
            userId: actor.id,
            at: now,
          }))
        )
          return { done: false } as const;
        const effect = await handOver(() =>
          this.handoff.poVersionConfirmed(fact),
        );
        await this.audit.record({
          actor: actorOf,
          action: "order.po_version_confirmed",
          entityType: "Order",
          entityId: orderNo,
          summary: `${actor.displayName} confirmed PO version ${String(revised.poVersionNo)} of order ${orderNo}`,
          changes: {
            poVersionNo: { from: stored.poVersionNo, to: revised.poVersionNo },
            version: { from: stored.version, to: stored.version + 1 },
            lines: revised.lines.length,
            headerFields: full.changedHeaderFields,
            lineChanges: {
              added: full.counts.added,
              removed: full.counts.removed,
              changed: full.counts.changed,
              moved: full.counts.moved,
            },
            workflowEffect: effect,
          },
          ip: info.ip,
          traceId: info.traceId,
        });
        return { done: true, effect } as const;
      });
    } catch (error) {
      if (!(error instanceof HandoffRefusedError)) throw error;
      await this.audit.record({
        actor: actorOf,
        action: "order.po_version_confirm.refused",
        entityType: "Order",
        entityId: orderNo,
        summary: `${actor.displayName}'s confirmation of PO version ${String(revised.poVersionNo)} of order ${orderNo} was refused by the order flow`,
        changes: {
          refusedBy: "workflow",
          code: error.refusal.code,
          poVersionNo: { from: stored.poVersionNo, to: revised.poVersionNo },
        },
        ip: info.ip,
        traceId: info.traceId,
      });
      throw error.refusal;
    }
    if (!outcome.done) throw await this.whyRefused(orderNo, expected);
    return {
      poVersionNo: revised.poVersionNo,
      supersedesPoVersionNo: stored.poVersionNo,
      differences: toDifferencesView(
        numbered(stored),
        numbered(revised),
        this.masking,
        actor.role,
      ),
      order: await this.orders.one(orderNo, actor.role),
    };
  }

  /** The one path of both routes. The order of the checks is the order of the refusals. */
  private async prepare(
    orderNo: string,
    body: CreateSalesOrderBody,
    actor: OrderWriter,
    expected?: number,
  ): Promise<Prepared> {
    const stored = await this.poVersions.headOf(orderNo);
    // A sample is not stored, so it answers 404 here like any unknown number.
    if (!stored) throw new NotFoundError("Order");
    stored.requireRevisable();
    if (expected !== undefined && stored.poVersionNo !== expected)
      throw this.stale(stored, expected);
    stored.requireSameOrder(body.customerNo, body.externalDocumentNo);
    await this.requireCustomer(stored.customerNo);
    const lines = draftLines(body, {
      items: await this.items.detailsOf(body.lines.map((l) => l.itemNo)),
      canSeePrice: this.masking.canSeeAmount(actor.role),
      stored: stored.lines.map((line) => line.toFacts()),
    });
    const revised = stored.revised({
      orderDate: body.orderDate,
      shipmentDate: body.shipmentDate,
      prepaymentPercent: padDecimal(body.prepaymentPercent, 2),
      lines,
    });
    const full = PoVersionDiff.between(numbered(stored), numbered(revised), {
      comparePrices: true,
    });
    return { stored, revised, full };
  }

  private stale(now: SalesOrder, expected: number): DomainError {
    return new DomainError(
      "CONFLICT",
      `Order ${now.orderNo} is now at PO version ${String(now.poVersionNo)}, and you compared with PO version ${String(expected)}. Compare again before you confirm.`,
      [{ path: PO_VERSION_STALE_PATH, message: String(now.poVersionNo) }],
    );
  }

  /** The guarded move said no: the order is no longer submitted, or someone revised it first. */
  private async whyRefused(
    orderNo: string,
    expected: number,
  ): Promise<DomainError> {
    const now = await this.poVersions.headOf(orderNo);
    if (!now) return new NotFoundError("Order");
    try {
      now.requireRevisable();
    } catch (error) {
      if (error instanceof DomainError) return error;
      throw error;
    }
    return this.stale(now, expected);
  }

  private async requireCustomer(customerNo: string): Promise<void> {
    if ((await this.customers.namesOf([customerNo])).has(customerNo)) return;
    throw new ValidationFailedError([
      {
        path: "customerNo",
        message: "No customer has this Business Central number.",
      },
    ]);
  }
}
