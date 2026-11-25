import { Inject, Injectable } from "@nestjs/common";
import type { SalesApprovalResult } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from "../../common/domain-error.js";
import type { RequestInfo } from "../governance/authorisation.service.js";
import { actorOf } from "./actor-of.js";
import { OrderWorkflowService } from "./order-workflow.service.js";

/**
 * The sales-side approval, kept as a capability and off by default (#251,
 * point 9; A-19): while SALES_APPROVAL is on, an order's PI waits for a
 * management approver. Area 4's policy says who may approve
 * (`sales-order.approve`); this adds what only area 2 knows. The order must
 * say who raised it, because the person who raised it never approves it, so a
 * seeded sample, which nobody raised, is refused. Only the approver may undo.
 * Every refusal is audited.
 */
@Injectable()
export class SalesApprovalService {
  constructor(
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async approve(
    orderNo: string,
    comment: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<SalesApprovalResult> {
    const raisedBy = await this.raisedBy(orderNo, auth, info);
    await this.workflow.decideSale(
      orderNo,
      { type: "SALES_APPROVED", byUserId: auth.user.id },
      {
        amount: (await this.workflow.snapshotOf(orderNo))?.orderTotal,
        requesterUserId: raisedBy,
      },
      actorOf(auth),
      info,
      now,
      () =>
        this.record(auth, info, orderNo, "workflows.sales.approved", {
          summary: `${auth.user.displayName} approved the sale ${orderNo}`,
          changes: { orderNo, comment },
        }),
    );
    return { applied: true, message: "Approved.", orderNo, approved: true };
  }

  async undo(
    orderNo: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<SalesApprovalResult> {
    const raisedBy = await this.raisedBy(orderNo, auth, info);
    const state = await this.workflow.snapshotOf(orderNo);
    if (state?.salesApproved && state.salesApprovedByUserId !== auth.user.id) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "not-the-decider",
        new DomainError(
          "FORBIDDEN",
          "Only the person who approved this sale can undo it.",
        ),
      );
    }
    await this.workflow.decideSale(
      orderNo,
      { type: "SALES_APPROVAL_UNDONE" },
      { amount: state?.orderTotal, requesterUserId: raisedBy },
      actorOf(auth),
      info,
      now,
      () =>
        this.record(auth, info, orderNo, "workflows.sales.approval-undone", {
          summary: `${auth.user.displayName} undid the approval of ${orderNo}`,
          changes: { orderNo },
        }),
    );
    return { applied: true, message: "Undone.", orderNo, approved: false };
  }

  /**
   * Who raised the order. Refused when the machine does not run it, when
   * nobody is known to have raised it, and for the person who raised it.
   */
  private async raisedBy(
    orderNo: string,
    auth: AuthContext,
    info: RequestInfo,
  ): Promise<string> {
    const state = await this.workflow.snapshotOf(orderNo);
    if (!state) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "not-running",
        new NotFoundError(`Order ${orderNo}'s workflow`),
      );
    }
    if (!state.raisedByUserId) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "requester-unknown",
        new ConflictError(
          "Who raised this order is not known, so it cannot be approved: whoever raised it must never be the one to approve it.",
        ),
      );
    }
    if (state.raisedByUserId === auth.user.id) {
      throw await this.refused(
        auth,
        info,
        orderNo,
        "no-self-approval",
        new DomainError("FORBIDDEN", "You do not have access to this."),
      );
    }
    return state.raisedByUserId;
  }

  private refused(
    auth: AuthContext,
    info: RequestInfo,
    orderNo: string,
    rule: string,
    error: DomainError,
  ): Promise<DomainError> {
    return this.record(auth, info, orderNo, "workflows.sales.refused", {
      summary: `${auth.user.displayName} was refused a sales approval on ${orderNo}: ${error.message}`,
      changes: { orderNo, rule },
    }).then(() => error);
  }

  private async record(
    auth: AuthContext,
    info: RequestInfo,
    orderNo: string,
    action: string,
    event: { summary: string; changes: Record<string, unknown> },
  ): Promise<void> {
    await this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action,
      entityType: "Order",
      entityId: orderNo,
      summary: event.summary,
      changes: event.changes,
      ip: info.ip,
      traceId: info.traceId,
    });
  }
}
