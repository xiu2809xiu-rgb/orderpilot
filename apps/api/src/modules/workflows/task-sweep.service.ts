import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NoticeKind, Role } from "@orderpilot/shared";
import { AuditService } from "../../audit/audit.service.js";
import { RolePermissionRepository } from "../../auth/role-permission.repository.js";
import { Database } from "../../database/database.js";
import { noticesDue, scheduleOf } from "./domain/task-schedule.js";
import { OrderWorkflowRepository } from "./order-workflow.repository.js";
import { SprRoutingService } from "./spr-routing.service.js";
import { WorkflowNoticeRepository } from "./workflow-notice.repository.js";
import {
  WorkflowTaskRepository,
  type OpenTask,
} from "./workflow-task.repository.js";

const ACTOR = "workflow-sweep";
const VERB = { REMINDER: "reminded", ESCALATION: "escalated" } as const;

interface Recipient {
  readonly role: Role;
  readonly userId: string | null;
}

/**
 * Sends what has come due: a reminder before a task is due, an escalation once
 * nobody has acted, and at the due time itself an event the tracker can flag
 * overdue from. Safe to run at any time and any number of times, because each
 * has a key the database holds only once.
 */
@Injectable()
export class TaskSweepService {
  private readonly logger = new Logger(TaskSweepService.name);

  constructor(
    @Inject(WorkflowTaskRepository)
    private readonly tasks: WorkflowTaskRepository,
    @Inject(WorkflowNoticeRepository)
    private readonly notices: WorkflowNoticeRepository,
    @Inject(OrderWorkflowRepository)
    private readonly orders: OrderWorkflowRepository,
    @Inject(SprRoutingService) private readonly routing: SprRoutingService,
    @Inject(Database) private readonly database: Database,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(RolePermissionRepository)
    private readonly matrix: RolePermissionRepository,
  ) {}

  /**
   * One failure must not stop the others. It throws at the end, so the job fails
   * and is retried, and the retry finds what already went.
   */
  async sweep(now: Date = new Date()): Promise<void> {
    const [tasks, slas, handovers] = await Promise.all([
      this.tasks.open(),
      this.tasks.slas(),
      this.routing.handovers(now),
    ]);
    const slaOf = new Map(slas.map((sla) => [sla.taskKind, sla]));
    let failed = 0;
    for (const task of tasks) {
      const sla = slaOf.get(task.kind);
      if (!sla) {
        // Silently sending nothing would look exactly like nothing being due.
        this.logger.warn({ kind: task.kind }, "A kind of task has no settings");
        continue;
      }
      const due = noticesDue(scheduleOf(task.createdAt, sla), now);
      const handover =
        task.kind === "APPROVE_SPR" ? handovers.get(task.orderRef) : undefined;
      const owner: Recipient = handover
        ? { role: handover.role, userId: handover.userId }
        : { role: task.assigneeRole, userId: null };
      // One at a time: each is its own transaction on the audit trail's chain.
      const steps = [
        ...(due.remind
          ? [
              () =>
                // Per person: when the SPR moves on, its new holder is told too.
                this.notify(
                  task,
                  "REMINDER",
                  owner,
                  now,
                  `task:${task.id}:reminder:${owner.userId ?? owner.role}`,
                ),
            ]
          : []),
        ...(due.overdue ? [() => this.markOverdue(task, now)] : []),
        ...(due.escalate
          ? [
              () =>
                this.escalate(
                  task,
                  "ESCALATION",
                  { role: sla.escalateToRole, userId: null },
                  now,
                  `task:${task.id}:escalation`,
                ),
            ]
          : []),
      ];
      for (const step of steps) {
        try {
          await step();
        } catch (error) {
          failed += 1;
          this.logger.error(
            { taskId: task.id, err: error },
            "A workflow notice could not be sent",
          );
        }
      }
    }
    if (failed > 0) {
      throw new Error(`${String(failed)} notices could not be sent`);
    }
  }

  /** The notice, its workflow event and its audit event go together or not at all. */
  private async notify(
    task: OpenTask,
    kind: NoticeKind,
    to: Recipient,
    now: Date,
    key: string,
  ): Promise<void> {
    const verb = VERB[kind];
    await this.database.transaction(async () => {
      // A decision may have landed since this sweep read the task.
      if (!(await this.tasks.isOpen(task.id))) return;
      const summary = `${task.kind} on ${task.orderRef}: ${verb}`;
      const sent = await this.notices.sendOnce({
        key,
        kind,
        message: summary,
        taskId: task.id,
        instanceId: task.instanceId,
        orderRef: task.orderRef,
        recipientRole: to.role,
        recipientUserId: to.userId,
        sentAt: now,
      });
      if (!sent) return;
      await this.orders.recordTaskEvent({
        key,
        type: `task.${verb}`,
        instanceId: task.instanceId,
        actorName: ACTOR,
        summary,
        data: { taskId: task.id, toRole: to.role, toUserId: to.userId },
        occurredAt: now,
      });
      await this.record(task, verb, summary, {
        toRole: to.role,
        toUserId: to.userId,
      });
    });
  }

  /**
   * The matrix can change after the setting was saved. An escalation to a role
   * that cannot see tasks would reach nobody and still use up its key, so it fails
   * loudly instead, and goes out once the role can see it again.
   */
  private async escalate(
    task: OpenTask,
    kind: NoticeKind,
    to: Recipient,
    now: Date,
    key: string,
  ): Promise<void> {
    if (!(await this.matrix.has(to.role, "workflows.read"))) {
      throw new Error(`${to.role} cannot see tasks, so nobody would be told`);
    }
    await this.notify(task, kind, to, now, key);
  }

  /** No notice: this is for the tracker's overdue flag, and the escalation tells people. */
  private async markOverdue(task: OpenTask, now: Date): Promise<void> {
    await this.database.transaction(async () => {
      if (!(await this.tasks.isOpen(task.id))) return;
      const summary = `${task.kind} on ${task.orderRef}: overdue`;
      const recorded = await this.orders.recordTaskEvent({
        key: `task:${task.id}:overdue`,
        type: "task.overdue",
        instanceId: task.instanceId,
        actorName: ACTOR,
        summary,
        data: { taskId: task.id },
        occurredAt: now,
      });
      if (recorded) await this.record(task, "overdue", summary, {});
    });
  }

  private async record(
    task: OpenTask,
    what: string,
    summary: string,
    changes: Record<string, string | null>,
  ): Promise<void> {
    await this.audit.record({
      actor: { kind: "system", name: ACTOR },
      action: `workflows.task.${what}`,
      entityType: "WorkflowTask",
      entityId: task.id,
      summary,
      changes,
      ip: null,
      traceId: ACTOR,
    });
  }
}
