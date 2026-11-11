import { Inject, Injectable } from "@nestjs/common";
import {
  SPR_DECISION_RECORDED_MESSAGE,
  SPR_DECISION_UNDONE_MESSAGE,
  SPR_PASSED_ON_MESSAGE,
  sprDecisionResultSchema,
  sprDecisionUndoResultSchema,
  type PolicyRequest,
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
import { Database } from "../../database/database.js";
import { UserRepository } from "../../users/user.repository.js";
import {
  AuthorisationService,
  type RequestInfo,
} from "../governance/authorisation.service.js";
import {
  CommandReplayService,
  type KeepAnswer,
} from "./command-replay.service.js";
import type { OrderActor } from "./domain/order-state-machine.js";
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

function actorOf(auth: AuthContext): OrderActor {
  return {
    kind: "user",
    userId: auth.user.id,
    name: auth.user.displayName,
    role: auth.user.role,
  };
}

/**
 * Approving or rejecting an SPR. Area 4's policy says who may decide and up to
 * what limit; the state machine says what the order does next; this decides what
 * happens above a limit. The amount and the requester always come from the SPR's
 * own record, so a request cannot talk its way under a limit.
 */
@Injectable()
export class SprApprovalService {
  constructor(
    @Inject(SprRecordRepository) private readonly records: SprRecordRepository,
    @Inject(WorkflowReadModel) private readonly model: WorkflowReadModel,
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
    @Inject(AuthorisationService)
    private readonly policy: AuthorisationService,
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(Database) private readonly database: Database,
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

    const verdict = await this.policy.decide(
      this.requestOf(recordNo, spr, auth),
      now,
    );
    // A rejection passes on too: someone with no authority over this amount
    // should not be the one to end it, and the decision stays with whoever has.
    if (verdict.outcome === "refused" && verdict.rule === "approval-limit") {
      return this.passOn(
        recordNo,
        spr,
        outcome,
        comment,
        auth,
        info,
        now,
        keep,
      );
    }

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
    if (!record) throw new NotFoundError(`Stock purchase request ${recordNo}`);
    return record.orderNo ? this.records.findByOrder(record.orderNo) : null;
  }

  /**
   * Passing an SPR up the chain makes each person the "requester" of the next
   * step in area 4's chain, so the original requester would no longer be what
   * its route rule compares. They must never decide it, so that is checked here.
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

  /** Sends the SPR to the next person on the chain, and says who that is. */
  private async passOn(
    recordNo: string,
    spr: StoredSpr,
    outcome: Outcome,
    comment: string,
    auth: AuthContext,
    info: RequestInfo,
    now: Date,
    keep: KeepAnswer<SprDecisionResult>,
  ): Promise<SprDecisionResult> {
    const status = await this.workflow.statusOf(spr.orderRef);
    if (status?.status !== "AwaitingSpr") {
      throw new ConflictError(
        "This order is not waiting for an SPR decision, so it cannot be passed on.",
      );
    }
    const requester = spr.passedOn?.byUserId ?? spr.requesterUserId;
    // A substitute stands in for the absent approver, so the chain goes on from
    // that approver. The substitute's own approver was never on this chain.
    const decider = await this.policy.deciderFor(requester, now);
    const from =
      decider.kind === "substitute" ? decider.standsInFor : auth.user.id;
    const next = await this.policy.deciderFor(from, now);
    if (
      next.kind === "none" ||
      next.userId === spr.requesterUserId ||
      next.userId === auth.user.id
    ) {
      throw new ConflictError(
        "This is above your limit, and nobody above you can take it.",
      );
    }
    const names = await this.users.namesByIds([next.userId]);
    const toName = names.get(next.userId) ?? next.userId;
    const answer: SprDecisionResult = {
      applied: true,
      message: SPR_PASSED_ON_MESSAGE,
      recordNo,
      outcome,
      comment,
      passedToName: toName,
    };
    await this.database.transaction(async () => {
      await this.records.save(spr, {
        passedOn: {
          byUserId: from,
          byName: auth.user.displayName,
          toName,
          outcome,
          comment,
          at: now.toISOString(),
        },
      });
      await this.audit.record({
        actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
        action: "workflows.spr.passed-on",
        entityType: "Spr",
        entityId: recordNo,
        summary: `${auth.user.displayName} passed ${recordNo} on to ${toName}, above their limit`,
        changes: { toUserId: next.userId, kind: next.kind, outcome, comment },
        ip: info.ip,
        traceId: info.traceId,
      });
      await keep(answer);
    });
    return answer;
  }

  /** The chain follows from the last hand-off: the passer, or the absent approver they stood in for. */
  private factsOf(recordNo: string, spr: StoredSpr) {
    return {
      recordNo,
      amount: spr.amount,
      requesterUserId: spr.passedOn?.byUserId ?? spr.requesterUserId,
    };
  }

  private requestOf(
    recordNo: string,
    spr: StoredSpr,
    auth: AuthContext,
  ): PolicyRequest {
    const facts = this.factsOf(recordNo, spr);
    return {
      actor: { userId: auth.user.id, role: auth.user.role },
      action: "spr.approve",
      resource: { type: "Spr", id: recordNo },
      amount: facts.amount,
      requesterUserId: facts.requesterUserId,
    };
  }
}
