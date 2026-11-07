import { Inject, Injectable } from "@nestjs/common";
import type {
  NoticeKind,
  PageQuery,
  Role,
  TaskKind,
  WorkflowNotice,
} from "@orderpilot/shared";
import { Database } from "../../database/database.js";

/** What a notice needs from its task to be shown. */
export interface NoticeTask {
  readonly id: string;
  readonly kind: TaskKind;
  readonly dueAt: Date;
}

export interface NewNotice {
  /** The same key means the same notice: a retried or doubled job finds it there. */
  readonly key: string;
  readonly kind: NoticeKind;
  readonly taskId: string;
  readonly instanceId: string;
  readonly orderRef: string;
  readonly recipientRole: Role;
  readonly recipientUserId: string | null;
  readonly message: string;
  readonly sentAt: Date;
}

/** The notices the sweep has really sent. Seeded samples have no key and stay out of this. */
@Injectable()
export class WorkflowNoticeRepository {
  constructor(@Inject(Database) private readonly database: Database) {}

  /** False when this notice has already gone, so the caller does nothing more. */
  async sendOnce(notice: NewNotice): Promise<boolean> {
    const { count } =
      await this.database.client.workflowNotification.createMany({
        data: [
          {
            dedupeKey: notice.key,
            kind: notice.kind,
            taskId: notice.taskId,
            instanceId: notice.instanceId,
            orderRef: notice.orderRef,
            recipientRole: notice.recipientRole,
            recipientUserId: notice.recipientUserId,
            message: notice.message,
            scheduledFor: notice.sentAt,
            sentAt: notice.sentAt,
          },
        ],
        skipDuplicates: true,
      });
    return count === 1;
  }

  /** What has gone to this person, or to their role with nobody named, on tasks still open. */
  async forPerson(
    userId: string,
    role: Role,
    openTasks: readonly NoticeTask[],
    query: PageQuery,
  ): Promise<{ items: WorkflowNotice[]; total: number }> {
    const where = {
      dedupeKey: { not: null },
      sentAt: { not: null },
      taskId: { in: openTasks.map((task) => task.id) },
      OR: [
        { recipientUserId: userId },
        { recipientUserId: null, recipientRole: role },
      ],
    };
    const [rows, total] = await Promise.all([
      this.database.client.workflowNotification.findMany({
        where,
        orderBy: { scheduledFor: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.database.client.workflowNotification.count({ where }),
    ]);
    const byId = new Map(openTasks.map((task) => [task.id, task]));
    return {
      items: rows.flatMap((row) => {
        const task = byId.get(row.taskId ?? "");
        return task && row.orderRef && row.sentAt && row.kind !== "INFO"
          ? [
              {
                id: row.id,
                kind: row.kind,
                taskKind: task.kind,
                orderNo: row.orderRef,
                dueAt: task.dueAt.toISOString(),
                sentAt: row.sentAt.toISOString(),
              },
            ]
          : [];
      }),
      total,
    };
  }
}
