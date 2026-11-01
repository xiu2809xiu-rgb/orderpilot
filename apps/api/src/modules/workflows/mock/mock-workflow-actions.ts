import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import {
  COMPLETABLE_TASK_KINDS,
  MOCK_RECORDED_MESSAGE,
  compareDecimal,
  ROLE_LABELS,
  type PaymentConfirmationInput,
  type PaymentResult,
  type PaymentUndoResult,
  type SprDecisionResult,
  type SprDecisionUndoResult,
  type TaskActionResult,
  type WorkflowTask,
} from "@orderpilot/shared";
import { AuditService } from "../../../audit/audit.service.js";
import type { AuthContext } from "../../../auth/auth-context.js";
import {
  ConflictError,
  DomainError,
  NotFoundError,
} from "../../../common/domain-error.js";
import { WorkflowReadModel } from "../workflow-read-model.js";
import { MockDecisionOverlay } from "./mock-decision-overlay.js";

/** Where a request came from, for the audit trail. */
export interface ActionInfo {
  readonly ip: string | null;
  readonly traceId: string;
}

const COMPLETABLE: ReadonlySet<string> = new Set(COMPLETABLE_TASK_KINDS);

/** Only a task the general routes close may be reopened by them. */
function assertCompletable(task: WorkflowTask): void {
  if (!COMPLETABLE.has(task.kind)) {
    throw new ConflictError(
      "This task is finished on its own screen, not by marking it done.",
    );
  }
}

/**
 * The commands on mock data: each writes a real audit event, then keeps its
 * result in the `MockDecisionOverlay`, and answers that it was recorded. The
 * audit comes first, so a failed write leaves nothing behind. Only the
 * permission on the route and the inbox the task sits in decide who may act.
 * Azri's state machine replaces this class, and then the rules are his.
 */
@Injectable()
export class MockWorkflowActions {
  private readonly working = new Set<string>();

  constructor(
    @Inject(MockDecisionOverlay) private readonly overlay: MockDecisionOverlay,
    @Inject(WorkflowReadModel) private readonly model: WorkflowReadModel,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async completeTask(
    taskId: string,
    auth: AuthContext,
    info: ActionInfo,
  ): Promise<TaskActionResult> {
    return this.oneAtATime(`task:${taskId}`, async () => {
      const task = await this.ownTask(taskId, auth, info);
      if (this.overlay.isClosed(taskId)) throw new NotFoundError("Task");
      assertCompletable(task);
      await this.write(auth, info, {
        action: "workflows.task.completed",
        entityType: "WorkflowTask",
        entityId: taskId,
        summary: `${auth.user.displayName} completed "${task.title}" for ${task.orderNo ?? "no order"} (mock)`,
        changes: { kind: task.kind, orderNo: task.orderNo },
      });
      this.overlay.closeTask(taskId);
      return this.taskResult(taskId, "DONE");
    });
  }

  async undoTask(
    taskId: string,
    auth: AuthContext,
    info: ActionInfo,
  ): Promise<TaskActionResult> {
    return this.oneAtATime(`task:${taskId}`, async () => {
      const task = await this.ownTask(taskId, auth, info);
      // A decision or a payment closes its task too. Reopening it here would
      // leave that decision or payment standing with its task back in the inbox.
      assertCompletable(task);
      if (!this.overlay.isClosed(taskId)) {
        throw new NotFoundError("A completed task");
      }
      await this.write(auth, info, {
        action: "workflows.task.reopened",
        entityType: "WorkflowTask",
        entityId: taskId,
        summary: `${auth.user.displayName} undid "${task.title}" for ${task.orderNo ?? "no order"} (mock)`,
        changes: { kind: task.kind, orderNo: task.orderNo },
      });
      this.overlay.reopenTask(taskId);
      return this.taskResult(taskId, "OPEN");
    });
  }

  async decide(
    recordNo: string,
    outcome: SprDecisionResult["outcome"],
    comment: string,
    auth: AuthContext,
    info: ActionInfo,
  ): Promise<SprDecisionResult> {
    return this.oneAtATime(`spr:${recordNo}`, async () => {
      if (this.overlay.decisionOf(recordNo)) {
        throw new ConflictError(
          "This request already has a decision. Undo it to decide again.",
        );
      }
      const task = (await this.model.tasksFor("APPROVER")).find(
        (entry) => entry.ref?.recordNo === recordNo,
      );
      await this.write(auth, info, {
        action: `workflows.spr.${outcome}`,
        entityType: "Spr",
        entityId: recordNo,
        summary: `${auth.user.displayName} ${outcome} ${recordNo} (mock)`,
        changes: { outcome, comment },
      });
      this.overlay.recordDecision(
        recordNo,
        {
          outcome,
          by: auth.user.displayName,
          comment,
          at: new Date().toISOString(),
        },
        task?.id ?? null,
      );
      return {
        applied: true,
        message: MOCK_RECORDED_MESSAGE,
        recordNo,
        outcome,
        comment,
      };
    });
  }

  async undoDecision(
    recordNo: string,
    auth: AuthContext,
    info: ActionInfo,
  ): Promise<SprDecisionUndoResult> {
    return this.oneAtATime(`spr:${recordNo}`, async () => {
      if (!this.overlay.decisionOf(recordNo)) {
        throw new NotFoundError(`A decision on ${recordNo}`);
      }
      await this.write(auth, info, {
        action: "workflows.spr.decision-undone",
        entityType: "Spr",
        entityId: recordNo,
        summary: `${auth.user.displayName} undid the decision on ${recordNo} (mock)`,
      });
      this.overlay.undoDecision(recordNo);
      return { applied: true, message: MOCK_RECORDED_MESSAGE, recordNo };
    });
  }

  async confirmPayment(
    orderNo: string,
    input: PaymentConfirmationInput,
    auth: AuthContext,
    info: ActionInfo,
  ): Promise<PaymentResult> {
    return this.oneAtATime(`payment:${orderNo}`, async () => {
      const repeated = this.overlay
        .paymentsOf(orderNo)
        .some(
          (record) =>
            record.paymentType === input.paymentType &&
            compareDecimal(record.amount, input.amount) === 0,
        );
      if (repeated) {
        throw new ConflictError("This payment is already confirmed.");
      }
      const task = (await this.model.tasksFor("FINANCE")).find(
        (entry) => entry.orderNo === orderNo,
      );
      const paymentId = randomUUID();
      await this.write(auth, info, {
        action: "workflows.payment.confirmed",
        entityType: "Payment",
        entityId: paymentId,
        summary: `${auth.user.displayName} confirmed a ${input.paymentType} for ${orderNo} (mock)`,
        changes: {
          orderNo,
          paymentType: input.paymentType,
          amount: input.amount,
          currencyCode: input.currencyCode,
          reference: input.reference,
        },
      });
      this.overlay.recordPayment(
        {
          ...input,
          id: paymentId,
          orderNo,
          confirmedAt: new Date().toISOString(),
          confirmedBy: auth.user.displayName,
        },
        task?.id ?? null,
      );
      return {
        applied: true,
        message: MOCK_RECORDED_MESSAGE,
        orderNo,
        paymentId,
        paymentType: input.paymentType,
      };
    });
  }

  async undoPayment(
    orderNo: string,
    paymentId: string,
    auth: AuthContext,
    info: ActionInfo,
  ): Promise<PaymentUndoResult> {
    return this.oneAtATime(`payment:${orderNo}`, async () => {
      const known = this.overlay
        .paymentsOf(orderNo)
        .some((record) => record.id === paymentId);
      if (!known) throw new NotFoundError("A payment confirmation");
      await this.write(auth, info, {
        action: "workflows.payment.undone",
        entityType: "Payment",
        entityId: paymentId,
        summary: `${auth.user.displayName} undid the payment confirmation for ${orderNo} (mock)`,
        changes: { orderNo },
      });
      this.overlay.undoPayment(orderNo, paymentId);
      return {
        applied: true,
        message: MOCK_RECORDED_MESSAGE,
        orderNo,
        paymentId,
      };
    });
  }

  /**
   * The audit write is awaited before the overlay records, so two quick calls
   * would both pass the checks and both be recorded. The second is refused
   * here, in the one process that holds the overlay.
   */
  private async oneAtATime<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (this.working.has(key)) {
      throw new ConflictError("This is already being recorded.");
    }
    this.working.add(key);
    try {
      return await work();
    } finally {
      this.working.delete(key);
    }
  }

  /** The task, when it sits in the caller's own inbox. A wrong role's call is refused and audited. */
  private async ownTask(
    taskId: string,
    auth: AuthContext,
    info: ActionInfo,
  ): Promise<WorkflowTask> {
    const task = await this.model.taskById(taskId);
    if (!task) throw new NotFoundError("Task");
    if (task.assigneeRole === auth.user.role) return task;
    await this.write(auth, info, {
      action: "workflows.task.refused",
      entityType: "WorkflowTask",
      entityId: taskId,
      summary: `${auth.user.displayName} was refused a task in the ${ROLE_LABELS[task.assigneeRole]} inbox`,
      changes: { reason: "not-in-own-inbox", inbox: task.assigneeRole },
    });
    throw new DomainError("FORBIDDEN", "This task is not in your inbox.");
  }

  private write(
    auth: AuthContext,
    info: ActionInfo,
    event: {
      action: string;
      entityType: string;
      entityId: string;
      summary: string;
      changes?: Record<string, unknown>;
    },
  ) {
    return this.audit.record({
      ...event,
      changes: { ...event.changes, mock: true },
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      ip: info.ip,
      traceId: info.traceId,
    });
  }

  private taskResult(
    taskId: string,
    status: TaskActionResult["status"],
  ): TaskActionResult {
    return { applied: true, message: MOCK_RECORDED_MESSAGE, taskId, status };
  }
}
