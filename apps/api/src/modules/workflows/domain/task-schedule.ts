import type { TaskSla } from "@orderpilot/shared";

const MINUTE = 60_000;

export interface TaskSchedule {
  readonly remindAt: Date;
  readonly dueAt: Date;
  readonly escalateAt: Date;
}

/** Each time follows from when the task was created, so a changed setting applies to open tasks too. */
export function scheduleOf(
  createdAt: Date,
  sla: Pick<
    TaskSla,
    "dueAfterMinutes" | "remindBeforeMinutes" | "escalateAfterMinutes"
  >,
): TaskSchedule {
  const due = createdAt.getTime() + sla.dueAfterMinutes * MINUTE;
  return {
    remindAt: new Date(due - sla.remindBeforeMinutes * MINUTE),
    dueAt: new Date(due),
    escalateAt: new Date(due + sla.escalateAfterMinutes * MINUTE),
  };
}

/** What has come due by `now`. A sweep that was down for a while may find both. */
export function noticesDue(
  schedule: TaskSchedule,
  now: Date,
): {
  readonly remind: boolean;
  readonly overdue: boolean;
  readonly escalate: boolean;
} {
  return {
    remind: now >= schedule.remindAt,
    overdue: now >= schedule.dueAt,
    escalate: now >= schedule.escalateAt,
  };
}
