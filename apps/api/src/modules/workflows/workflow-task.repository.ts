import { Inject, Injectable } from "@nestjs/common";
import {
  taskKindSchema,
  type OrderStatus,
  type Role,
  type TaskKind,
  type TaskSla,
  type TaskSlaChange,
} from "@orderpilot/shared";
import { Database } from "../../database/database.js";
import { Prisma } from "../../generated/prisma/client.js";
import { scheduleOf } from "./domain/task-schedule.js";

export interface OpenTask {
  readonly id: string;
  readonly instanceId: string;
  readonly orderRef: string;
  readonly kind: TaskKind;
  readonly title: string;
  readonly assigneeRole: Role;
  readonly createdAt: Date;
  readonly dueAt: Date;
}

/** Only orders the state machine runs. A seeded sample has no facts, and its due dates are fixtures. */
const ON_A_RUNNING_ORDER = { instance: { facts: { not: Prisma.DbNull } } };

/**
 * The status in which a kind of task can be acted on. On a held order nobody can
 * decide, so telling them "nobody has acted" would be false. Later steps add a
 * row here as the machine starts creating their tasks.
 */
const ACTIONABLE_IN: Partial<Record<TaskKind, OrderStatus>> = {
  APPROVE_SPR: "AwaitingSpr",
};

/** Tasks on the orders the state machine runs, and the settings that time them. */
@Injectable()
export class WorkflowTaskRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  async open(): Promise<OpenTask[]> {
    const rows = await this.database.client.workflowTask.findMany({
      where: { status: "OPEN", ...ON_A_RUNNING_ORDER },
      select: {
        id: true,
        instanceId: true,
        kind: true,
        title: true,
        assigneeRole: true,
        createdAt: true,
        dueAt: true,
        instance: { select: { orderRef: true, status: true } },
      },
    });
    return rows.flatMap((row) => {
      const kind = taskKindSchema.safeParse(row.kind);
      const actionable = kind.success && ACTIONABLE_IN[kind.data];
      return kind.success && (!actionable || actionable === row.instance.status)
        ? [
            {
              id: row.id,
              instanceId: row.instanceId,
              orderRef: row.instance.orderRef,
              kind: kind.data,
              title: row.title,
              assigneeRole: row.assigneeRole,
              createdAt: row.createdAt,
              dueAt: row.dueAt,
            },
          ]
        : [];
    });
  }

  async isOpen(id: string): Promise<boolean> {
    const count = await this.database.client.workflowTask.count({
      where: { id, status: "OPEN" },
    });
    return count === 1;
  }

  /** A finished task is what stops its reminders, so a decision closes it and an undo reopens it. */
  async setOpen(
    orderRef: string,
    kind: TaskKind,
    open: boolean,
    now: Date,
  ): Promise<void> {
    await this.database.client.workflowTask.updateMany({
      where: { kind, instance: { orderRef } },
      data: open
        ? { status: "OPEN", completedAt: null }
        : { status: "DONE", completedAt: now },
    });
  }

  async slas(): Promise<TaskSla[]> {
    const rows = await this.database.client.workflowTaskSla.findMany({
      orderBy: { taskKind: "asc" },
    });
    return rows.flatMap((row) => {
      const taskKind = taskKindSchema.safeParse(row.taskKind);
      return taskKind.success
        ? [
            {
              taskKind: taskKind.data,
              dueAfterMinutes: row.dueAfterMinutes,
              remindBeforeMinutes: row.remindBeforeMinutes,
              escalateAfterMinutes: row.escalateAfterMinutes,
              escalateToRole: row.escalateToRole,
            },
          ]
        : [];
    });
  }

  /** Closed tasks too: an undo reopens them, and the stored due date must not drift from the schedule. */
  async saveSla(taskKind: TaskKind, change: TaskSlaChange): Promise<void> {
    await this.database.client.workflowTaskSla.upsert({
      where: { taskKind },
      create: { ...change, taskKind },
      update: change,
    });
    const open = await this.database.client.workflowTask.findMany({
      where: { kind: taskKind, ...ON_A_RUNNING_ORDER },
      select: { id: true, createdAt: true },
    });
    for (const task of open) {
      await this.database.client.workflowTask.update({
        where: { id: task.id },
        data: { dueAt: scheduleOf(task.createdAt, change).dueAt },
      });
    }
  }
}
