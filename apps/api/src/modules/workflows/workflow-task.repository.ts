import { Inject, Injectable } from "@nestjs/common";
import {
  DEFAULT_TASK_SLAS,
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
  RAISE_SPR: "StockChecked",
  APPROVE_SPR: "AwaitingSpr",
  PLACE_VENDOR_PO: "SprApproved",
  CONFIRM_PAYMENT: "AwaitingPayment",
  PACK_ORDER: "Paid",
};

/** One task on an order the state machine runs, read by its id. */
export interface StoredTask {
  readonly id: string;
  readonly orderRef: string;
  readonly kind: TaskKind;
  readonly title: string;
  readonly assigneeRole: Role;
  readonly recordNo: string | null;
  readonly open: boolean;
}

/** One of a role's tasks on a running order, and whether it is still to do. */
export interface RoleTask {
  readonly id: string;
  readonly orderRef: string;
  readonly kind: TaskKind;
  readonly title: string;
  readonly assigneeRole: Role;
  readonly createdAt: Date;
  readonly dueAt: Date;
  readonly open: boolean;
}

/** A task a move of the order opens, as `openTask` needs it. */
export interface TaskToOpen {
  readonly orderRef: string;
  readonly kind: TaskKind;
  readonly title: string;
  readonly assigneeRole: Role;
  /** The record it is about, such as the SPR, so its page opens from the task. */
  readonly recordNo: string | null;
  readonly now: Date;
  readonly dueAt: Date;
}

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

  /**
   * Opens a kind of task on an order, from now: its row again when the order has
   * one, so an undo and a redo never leave two, and a new row the first time.
   */
  async openTask(task: TaskToOpen): Promise<void> {
    const client = this.database.client;
    const instance = await client.workflowInstance.findFirst({
      where: { orderRef: task.orderRef },
      select: { id: true },
    });
    if (!instance) throw new Error(`No workflow for ${task.orderRef}`);
    const existing = await client.workflowTask.findFirst({
      where: { instanceId: instance.id, kind: task.kind },
      select: { id: true },
    });
    const fields = {
      title: task.title,
      assigneeRole: task.assigneeRole,
      recordNo: task.recordNo,
      status: "OPEN" as const,
      completedAt: null,
      createdAt: task.now,
      dueAt: task.dueAt,
    };
    if (existing) {
      await client.workflowTask.update({
        where: { id: existing.id },
        data: fields,
      });
    } else {
      await client.workflowTask.create({
        data: { ...fields, instanceId: instance.id, kind: task.kind },
      });
    }
  }

  /** When a task of this kind opened now falls due: the stored setting, else the default. */
  async dueFor(kind: TaskKind, now: Date): Promise<Date> {
    const sla =
      (await this.slas()).find((entry) => entry.taskKind === kind) ??
      DEFAULT_TASK_SLAS.find((entry) => entry.taskKind === kind);
    return sla ? scheduleOf(now, sla).dueAt : now;
  }

  /**
   * The task with this id when its order runs on the state machine, open or
   * done, or null: for a sample the machine never ran, the mock answers instead.
   */
  async running(id: string): Promise<StoredTask | null> {
    const row = await this.database.client.workflowTask.findFirst({
      where: { id, ...ON_A_RUNNING_ORDER },
      select: {
        id: true,
        kind: true,
        title: true,
        assigneeRole: true,
        recordNo: true,
        status: true,
        instance: { select: { orderRef: true } },
      },
    });
    const kind = taskKindSchema.safeParse(row?.kind);
    if (!row || !kind.success) return null;
    return {
      id: row.id,
      orderRef: row.instance.orderRef,
      kind: kind.data,
      title: row.title,
      assigneeRole: row.assigneeRole,
      recordNo: row.recordNo,
      open: row.status === "OPEN",
    };
  }

  /** Marks one task done, or open again, by its id. */
  async setOpenById(id: string, open: boolean, now: Date): Promise<void> {
    await this.database.client.workflowTask.update({
      where: { id },
      data: open
        ? { status: "OPEN", completedAt: null }
        : { status: "DONE", completedAt: now },
    });
  }

  /**
   * A role's tasks on the orders the state machine runs, open or done. For those
   * orders this, not the sample data, says whether a task is still to do: a task
   * counts as open only while the order is where it can be acted on.
   */
  async forRole(role: Role): Promise<RoleTask[]> {
    const rows = await this.database.client.workflowTask.findMany({
      where: { assigneeRole: role, ...ON_A_RUNNING_ORDER },
      select: {
        id: true,
        kind: true,
        title: true,
        status: true,
        createdAt: true,
        dueAt: true,
        instance: { select: { orderRef: true, status: true } },
      },
    });
    return rows.flatMap((row) => {
      const kind = taskKindSchema.safeParse(row.kind);
      if (!kind.success) return [];
      const actionable = ACTIONABLE_IN[kind.data];
      return [
        {
          id: row.id,
          orderRef: row.instance.orderRef,
          kind: kind.data,
          title: row.title,
          assigneeRole: role,
          createdAt: row.createdAt,
          dueAt: row.dueAt,
          open:
            row.status === "OPEN" &&
            (!actionable || actionable === row.instance.status),
        },
      ];
    });
  }

  /** The open task of a kind on an order, or null. */
  async openOf(
    orderRef: string,
    kind: TaskKind,
  ): Promise<{ id: string; dueAt: Date; createdAt: Date } | null> {
    return this.database.client.workflowTask.findFirst({
      where: {
        kind,
        status: "OPEN",
        instance: { orderRef, facts: { not: Prisma.DbNull } },
      },
      select: { id: true, dueAt: true, createdAt: true },
    });
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
