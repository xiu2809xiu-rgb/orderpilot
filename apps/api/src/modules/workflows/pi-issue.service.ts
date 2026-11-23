import { Inject, Injectable } from "@nestjs/common";
import type { PiReissueResult } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import {
  ConflictError,
  type DomainError,
  NotFoundError,
} from "../../common/domain-error.js";
import { Database } from "../../database/database.js";
import type { RequestInfo } from "../governance/authorisation.service.js";
import { actorOf } from "./actor-of.js";
import { OrderWorkflowService } from "./order-workflow.service.js";
import { PaymentConfirmationRepository } from "./payment-confirmation.repository.js";
import { PiRecordRepository } from "./pi-record.repository.js";
import { CONFIRM_PAYMENT_TITLE, PACK_ORDER_TITLE } from "./running-payments.js";
import {
  WorkflowTaskRepository,
  type StoredTask,
} from "./workflow-task.repository.js";

/**
 * Support's PI on an order the state machine runs (#251, point 6). Sending it
 * moves the order to wait for payment and opens the next team's task: Finance's
 * when a prepayment is due, else the warehouse's. Undoing the send takes back
 * a mark made by mistake, while nothing has followed. A PI that really went
 * out wrong is reversed and reissued instead: the issue number goes up, and
 * the reason, who and when are kept and audited.
 */
@Injectable()
export class PiIssueService {
  constructor(
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
    @Inject(PiRecordRepository) private readonly pis: PiRecordRepository,
    @Inject(PaymentConfirmationRepository)
    private readonly payments: PaymentConfirmationRepository,
    @Inject(WorkflowTaskRepository)
    private readonly tasks: WorkflowTaskRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(Database) private readonly database: Database,
  ) {}

  async send(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<void> {
    const due = await this.workflow.prepaymentDueOf(task.orderRef);
    const next =
      due === null
        ? {
            kind: "PACK_ORDER" as const,
            title: PACK_ORDER_TITLE,
            role: "WAREHOUSE" as const,
          }
        : {
            kind: "CONFIRM_PAYMENT" as const,
            title: CONFIRM_PAYMENT_TITLE,
            role: "FINANCE" as const,
          };
    const dueAt = await this.tasks.dueFor(next.kind, now);
    await this.workflow.apply(
      task.orderRef,
      { type: "PI_SENT" },
      actorOf(auth),
      info,
      now,
      async () => {
        await this.pis.markSent(task.orderRef, auth.user.displayName, now);
        await this.tasks.setOpenById(task.id, false, now);
        await this.tasks.openTask({
          orderRef: task.orderRef,
          kind: next.kind,
          title: next.title,
          assigneeRole: next.role,
          recordNo: null,
          now,
          dueAt,
        });
      },
    );
  }

  /** Only while nothing has followed: no payment kept against it, nothing packed. */
  async unsend(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<void> {
    if ((await this.payments.forOrder(task.orderRef)).length > 0) {
      throw await this.refused(
        auth,
        info,
        task.orderRef,
        "payment-kept",
        new ConflictError(
          "A payment has been confirmed against this PI, so it cannot be taken back.",
        ),
      );
    }
    await this.workflow.apply(
      task.orderRef,
      { type: "PI_SEND_UNDONE" },
      actorOf(auth),
      info,
      now,
      async () => {
        await this.pis.unmarkSent(task.orderRef);
        await this.tasks.setOpen(task.orderRef, "CONFIRM_PAYMENT", false, now);
        await this.tasks.setOpen(task.orderRef, "PACK_ORDER", false, now);
        await this.tasks.setOpenById(task.id, true, now);
      },
    );
  }

  /**
   * Reverses the PI that went out and issues it again, with a reason. Only
   * while the order waits for payment and none has been confirmed: once money
   * has come in against it, the payment is taken back first.
   */
  async reissue(
    orderNo: string,
    reason: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<PiReissueResult> {
    const sent = await this.pis.sentOf(orderNo);
    if (!sent) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "not-sent",
        new NotFoundError(`A sent PI for ${orderNo}`),
      );
    }
    const view = await this.workflow.statusOf(orderNo);
    const paid = (await this.payments.forOrder(orderNo)).length > 0;
    if (view?.status !== "AwaitingPayment" || paid) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "moved-on",
        new ConflictError(
          "The order has moved on from this PI, so it cannot be reissued here. Take back the payment or the packing first.",
        ),
      );
    }
    // The PI's record keeps the reversal for the order's timeline; the audit
    // trail keeps who did it, with the reason.
    const data = await this.database.transaction(async () => {
      const next = await this.pis.reissue(sent, {
        reason,
        by: auth.user.displayName,
        at: now,
      });
      await this.audit.record({
        actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
        action: "workflows.pi.reissued",
        entityType: "Pi",
        entityId: sent.recordNo,
        summary: `${auth.user.displayName} reversed and reissued ${sent.recordNo} for ${orderNo}`,
        changes: {
          orderNo,
          reversedIssue: sent.issue,
          issue: next.issue,
          reason,
        },
        ip: info.ip,
        traceId: info.traceId,
      });
      return next;
    });
    return {
      applied: true,
      message: "Reversed and reissued.",
      orderNo,
      recordNo: sent.recordNo,
      issue: data.issue,
    };
  }

  /** Audits a refusal, outside any transaction, and hands back the error to throw. */
  private async refused(
    auth: AuthContext,
    info: RequestInfo,
    orderNo: string,
    reason: string,
    error: DomainError,
  ): Promise<DomainError> {
    await this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action: "workflows.pi.refused",
      entityType: "Order",
      entityId: orderNo,
      summary: `${auth.user.displayName} was refused a PI action on ${orderNo}: ${error.message}`,
      changes: { reason, orderNo },
      ip: info.ip,
      traceId: info.traceId,
    });
    return error;
  }
}
