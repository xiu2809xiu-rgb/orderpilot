import { Inject, Injectable } from "@nestjs/common";
import {
  ROLE_LABELS,
  TASK_RECORDED_MESSAGE,
  TASK_UNDONE_MESSAGE,
  type TaskActionResult,
} from "@orderpilot/shared";
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
import { SprRaiseService } from "./spr-raise.service.js";
import type { StoredTask } from "./workflow-task.repository.js";
import { WorkflowTaskRepository } from "./workflow-task.repository.js";

/**
 * Completing and undoing the tasks of orders the state machine runs. Raising an
 * SPR moves the order (`SprRaiseService`), and so does packing, which starts the
 * order's packing on the machine for Support to invoice; placing the vendor PO, the product
 * manager's step after an approval, only closes its task, because what follows
 * is Support's PI, which the machine already waits for. Every other kind is
 * finished on its own screen. Only the task's own role may act, and a refusal is
 * audited, as for the mock's tasks.
 */
@Injectable()
export class RunningTaskActions {
  constructor(
    @Inject(WorkflowTaskRepository)
    private readonly tasks: WorkflowTaskRepository,
    @Inject(SprRaiseService) private readonly raises: SprRaiseService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(OrderWorkflowService)
    private readonly workflow: OrderWorkflowService,
  ) {}

  /** The task when its order runs on the machine; null hands it back to the mock. */
  find(taskId: string): Promise<StoredTask | null> {
    return this.tasks.running(taskId);
  }

  async complete(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<TaskActionResult> {
    await this.ownTask(task, auth, info);
    if (!DONE_HERE.has(task.kind)) throw finishedElsewhere();
    if (!task.open) throw new NotFoundError("Task");
    if (task.kind === "RAISE_SPR") {
      await this.raises.raise(task, auth, info, now);
    } else if (task.kind === "PACK_ORDER") {
      await this.workflow.apply(
        task.orderRef,
        { type: "PACKING_STARTED" },
        actorOf(auth),
        info,
        now,
        () => this.tasks.setOpenById(task.id, false, now),
      );
    } else {
      await this.tasks.setOpenById(task.id, false, now);
      await this.record(
        task,
        auth,
        info,
        "workflows.task.completed",
        "completed",
      );
    }
    return result(task.id, "DONE");
  }

  async undo(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
    now: Date = new Date(),
  ): Promise<TaskActionResult> {
    await this.ownTask(task, auth, info);
    if (!DONE_HERE.has(task.kind)) throw finishedElsewhere();
    if (task.open) throw new NotFoundError("A completed task");
    if (task.kind === "RAISE_SPR") {
      await this.raises.withdraw(task, auth, info, now);
    } else if (task.kind === "PACK_ORDER") {
      await this.workflow.apply(
        task.orderRef,
        { type: "PACKING_UNDONE" },
        actorOf(auth),
        info,
        now,
        () => this.tasks.setOpenById(task.id, true, now),
      );
    } else {
      await this.tasks.setOpenById(task.id, true, now);
      await this.record(task, auth, info, "workflows.task.reopened", "undid");
    }
    return result(task.id, "OPEN");
  }

  private async ownTask(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
  ): Promise<void> {
    if (task.assigneeRole === auth.user.role) return;
    await this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action: "workflows.task.refused",
      entityType: "WorkflowTask",
      entityId: task.id,
      summary: `${auth.user.displayName} was refused a task in the ${ROLE_LABELS[task.assigneeRole]} inbox`,
      changes: { reason: "not-in-own-inbox", inbox: task.assigneeRole },
      ip: info.ip,
      traceId: info.traceId,
    });
    throw new DomainError("FORBIDDEN", "This task is not in your inbox.");
  }

  private record(
    task: StoredTask,
    auth: AuthContext,
    info: RequestInfo,
    action: string,
    verb: string,
  ) {
    return this.audit.record({
      actor: { kind: "user", userId: auth.user.id, role: auth.user.role },
      action,
      entityType: "WorkflowTask",
      entityId: task.id,
      summary: `${auth.user.displayName} ${verb} "${task.title}" for ${task.orderRef}`,
      changes: { kind: task.kind, orderNo: task.orderRef },
      ip: info.ip,
      traceId: info.traceId,
    });
  }
}

/** The kinds a person finishes by marking them done; the rest on their own screens. */
const DONE_HERE: ReadonlySet<string> = new Set([
  "RAISE_SPR",
  "PLACE_VENDOR_PO",
  "PACK_ORDER",
]);

function finishedElsewhere(): ConflictError {
  return new ConflictError(
    "This task is finished on its own screen, not by marking it done.",
  );
}

function result(
  taskId: string,
  status: TaskActionResult["status"],
): TaskActionResult {
  return {
    applied: true,
    message: status === "DONE" ? TASK_RECORDED_MESSAGE : TASK_UNDONE_MESSAGE,
    taskId,
    status,
  };
}
