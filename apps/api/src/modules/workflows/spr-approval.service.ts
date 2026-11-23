import { Inject, Injectable } from "@nestjs/common";
import {
  SPR_DECISION_RECORDED_MESSAGE,
  SPR_DECISION_UNDONE_MESSAGE,
  sprDecisionResultSchema,
  sprDecisionUndoResultSchema,
  type SprDecisionResult,
  type SprDecisionUndoResult,
} from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import type { AuthContext } from "../../auth/auth-context.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from "../../common/domain-error.js";
import type { RequestInfo } from "../governance/authorisation.service.js";
import {
  CommandReplayService,
  type KeepAnswer,
} from "./command-replay.service.js";
import { actorOf } from "./actor-of.js";
import { PLACE_VENDOR_PO_TITLE, RAISE_SPR_TITLE } from "./spr-raise.service.js";
import { OrderWorkflowService } from "./order-workflow.service.js";
import {
  SprRecordRepository,
  type StoredSpr,
} from "./spr-record.repository.js";
import { WorkflowReadModel } from "./workflow-read-model.js";
import { WorkflowTaskRepository } from "./workflow-task.repository.js";

type Outcome = SprDecisionResult["outcome"];

/** How a command was sent: the caller's Idempotency-Key, and the time, which tests set. */
export interface CommandOptions {
  readonly key?: string;
  readonly now?: Date;
}

/**
 * Whom a decision hands the SPR back to, and for what: an approval to the
 * product manager to place the vendor PO, a rejection to correct the SPR and
 * raise it again.
 */
function handBackOf(outcome: Outcome): {
  kind: "PLACE_VENDOR_PO" | "RAISE_SPR";
  title: string;
} {
  return outcome === "approved"
    ? { kind: "PLACE_VENDOR_PO", title: PLACE_VENDOR_PO_TITLE }
    : { kind: "RAISE_SPR", title: RAISE_SPR_TITLE };
}

/**
 * Approving or rejecting an SPR. Area 4's policy says who may decide: any one of
 * the approver group, never the requester, and within their limit while limits
 * are on (ADR 0056). The state machine says what the order does next. The
 * amount and the requester always come from the SPR's own record, so a request
 * cannot talk its way under a limit. Nothing is passed on: above someone's limit
 * the policy refuses, and another approver decides.
 */
@Injectable()
export class SprApprovalService {
  constructor(
    @Inject(SprRecordRepository) private readonly records: SprRecordRepository,
    @Inject(WorkflowReadModel) private readonly model: WorkflowReadModel,
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(WorkflowTaskRepository)
    private readonly tasks: WorkflowTaskRepository,
    @Inject(CommandReplayService)
    private readonly replay: CommandReplayService,
  ) {}

  /** Sent again with the same key, it answers as it did the first time and does nothing. */
  async decide(
    recordNo: string,
    outcome: Outcome,
    comment: string,
    auth: AuthContext,
    info: RequestInfo,
    { key, now = new Date() }: CommandOptions = {},
  ): Promise<SprDecisionResult> {
    return this.replay.once(
      {
        key,
        actorUserId: auth.user.id,
        command: outcome === "approved" ? "spr.approve" : "spr.reject",
        target: recordNo,
        body: { comment },
      },
      sprDecisionResultSchema,
      (keep) =>
        this.decideOnce(recordNo, outcome, comment, auth, info, now, keep),
    );
  }

  private async decideOnce(
    recordNo: string,
    outcome: Outcome,
    comment: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date,
    keep: KeepAnswer<SprDecisionResult>,
  ): Promise<SprDecisionResult> {
    const spr = await this.storedOf(recordNo);
    if (!spr) {
      throw new ConflictError(
        "This request is a sample that the workflow does not run, so it cannot be decided.",
      );
    }
    if (spr.decision) {
      throw new ConflictError(
        "This request already has a decision. Undo it to decide again.",
      );
    }
    await this.refuseTheRequester(recordNo, spr, auth, info);

    const handBack = handBackOf(outcome);
    const handBackDue = await this.tasks.dueFor(handBack.kind, now);
    const decision = {
      outcome,
      by: auth.user.displayName,
      comment,
      at: now.toISOString(),
    };
    const answer: SprDecisionResult = {
      applied: true,
      message: SPR_DECISION_RECORDED_MESSAGE,
      recordNo,
      outcome,
      comment,
    };
    await this.workflow.decideSpr(
      spr.orderRef,
      outcome === "approved"
        ? { type: "SPR_APPROVED" }
        : { type: "SPR_REJECTED", reason: comment },
      this.factsOf(recordNo, spr),
      actorOf(auth),
      info,
      now,
      async () => {
        await this.records.save(spr, { decision });
        await this.tasks.setOpen(spr.orderRef, "APPROVE_SPR", false, now);
        // The decision hands the SPR back to the product manager (Spectra, 5 Nov).
        await this.tasks.openTask({
          orderRef: spr.orderRef,
          kind: handBack.kind,
          title: handBack.title,
          assigneeRole: "PRODUCT_MANAGER",
          recordNo,
          now,
          dueAt: handBackDue,
        });
        await this.audit.record({
          actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
          action: `workflows.spr.${outcome}`,
          entityType: "Spr",
          entityId: recordNo,
          summary: `${auth.user.displayName} ${outcome} ${recordNo}`,
          changes: { outcome, comment },
          ip: info.ip,
          traceId: info.traceId,
        });
        await keep(answer);
      },
    );
    return answer;
  }

  /** Sent again with the same key, it answers as it did the first time and does nothing. */
  async undo(
    recordNo: string,
    auth: AuthContext,
    info: RequestInfo,
    { key, now = new Date() }: CommandOptions = {},
  ): Promise<SprDecisionUndoResult> {
    return this.replay.once(
      {
        key,
        actorUserId: auth.user.id,
        command: "spr.undo",
        target: recordNo,
        body: {},
      },
      sprDecisionUndoResultSchema,
      (keep) => this.undoOnce(recordNo, auth, info, now, keep),
    );
  }

  private async undoOnce(
    recordNo: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date,
    keep: KeepAnswer<SprDecisionUndoResult>,
  ): Promise<SprDecisionUndoResult> {
    const spr = await this.storedOf(recordNo);
    if (!spr?.decision) throw new NotFoundError(`A decision on ${recordNo}`);
    await this.refuseTheRequester(recordNo, spr, auth, info);
    const answer: SprDecisionUndoResult = {
      applied: true,
      message: SPR_DECISION_UNDONE_MESSAGE,
      recordNo,
    };
    await this.workflow.decideSpr(
      spr.orderRef,
      { type: "SPR_DECISION_UNDONE" },
      this.factsOf(recordNo, spr),
      actorOf(auth),
      info,
      now,
      async () => {
        await this.records.save(spr, { decision: null });
        await this.tasks.setOpen(spr.orderRef, "APPROVE_SPR", true, now);
        // Undone, the decision takes back the task it handed on.
        if (spr.decision) {
          await this.tasks.setOpen(
            spr.orderRef,
            handBackOf(spr.decision.outcome).kind,
            false,
            now,
          );
        }
        await this.audit.record({
          actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
          action: "workflows.spr.decision-undone",
          entityType: "Spr",
          entityId: recordNo,
          summary: `${auth.user.displayName} undid the decision on ${recordNo}`,
          changes: { undone: spr.decision },
          ip: info.ip,
          traceId: info.traceId,
        });
        await keep(answer);
      },
    );
    return answer;
  }

  private async storedOf(recordNo: string): Promise<StoredSpr | null> {
    const record = await this.model.sprByRecordNo(recordNo);
    if (!record)
      throw new NotFoundError(`Stock purchase requisition ${recordNo}`);
    return record.orderNo ? this.records.findByOrder(record.orderNo) : null;
  }

  /**
   * The requester never decides their own SPR. Area 4's group leaves them out
   * as well; this refuses it first, with area 2's own audit row, so an undo is
   * covered by the same rule.
   */
  private async refuseTheRequester(
    recordNo: string,
    spr: StoredSpr,
    auth: AuthContext,
    info: RequestInfo,
  ): Promise<void> {
    if (auth.user.id !== spr.requesterUserId) return;
    await this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action: "workflows.spr.refused",
      entityType: "Spr",
      entityId: recordNo,
      summary: `${auth.user.displayName} was refused a decision on their own request ${recordNo}`,
      changes: { rule: "no-self-approval" },
      ip: info.ip,
      traceId: info.traceId,
    });
    throw new DomainError("FORBIDDEN", "You do not have access to this.");
  }

  /** What area 4's policy judges: the SPR's own amount and the person who raised it. */
  private factsOf(recordNo: string, spr: StoredSpr) {
    return {
      recordNo,
      amount: spr.amount,
      requesterUserId: spr.requesterUserId,
    };
  }
}
