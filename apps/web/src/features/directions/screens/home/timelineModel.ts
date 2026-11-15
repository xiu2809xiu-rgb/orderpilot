import type { WorkflowTask } from "@orderpilot/shared";
import {
  expectedBy,
  SALES_STEP_IDS,
  statOf,
  usualDuration,
} from "../../data/estimates";
import type { ExpectedBy, SalesStepId, Usual } from "../../data/estimates";
import type { StepTime } from "../../data/types";

// My timeline, worked out from the person's real open tasks and the measured
// step times. Nothing here is a guess: a step the data cannot time gets no
// number, and the screen says nothing about it.

/** The step of the sales flow a kind of task belongs to. */
const STEP_OF_TASK: Record<WorkflowTask["kind"], SalesStepId> = {
  REVIEW_FIELDS: "poIn",
  RAISE_SPR: "stock",
  APPROVE_SPR: "stock",
  SEND_PI: "pi",
  CONFIRM_PAYMENT: "payment",
  PACK_ORDER: "pack",
  RECOUNT_CARTONS: "pack",
  ADD_SHIPPING_DOCUMENTS: "documents",
};

export interface TimelineEntry {
  task: WorkflowTask;
  stepId: SalesStepId;
  /** Where the step sits in the nine, 1 to 9. */
  position: number;
  /** When the order reached this step: the day the task was made. */
  since: Date;
  /** What the step usually takes, or null when the data cannot say. */
  usual: Usual | null;
  /** When the step should be done if it takes its usual time, or null. */
  expected: ExpectedBy | null;
  /** True once the wait has passed the usual time; null with no usual time. */
  pastUsual: boolean | null;
}

export interface TimelineModel {
  now: TimelineEntry | null;
  next: TimelineEntry[];
  /** Over every open task, not only those shown. */
  waiting: number;
  late: number;
  /** The latest due time of any open task. */
  lastDue: Date | null;
}

/** How many tasks the Next part lists. */
export const NEXT_SHOWN = 3;

function entryFor(
  task: WorkflowTask,
  steps: readonly StepTime[],
  at: Date,
): TimelineEntry {
  const stepId = STEP_OF_TASK[task.kind];
  const stat = statOf(steps, stepId);
  const since = new Date(task.createdAt);
  const expected = stat ? expectedBy(since, stat) : null;
  return {
    task,
    stepId,
    position: SALES_STEP_IDS.indexOf(stepId) + 1,
    since,
    usual: stat ? usualDuration(stat) : null,
    expected,
    pastUsual: expected ? expected.at.getTime() < at.getTime() : null,
  };
}

/**
 * The first task, in the inbox's own order, is the one in hand; the next few
 * follow. `tasks` must be that order: the API sorts the most urgent first.
 */
export function buildTimeline(
  tasks: readonly WorkflowTask[],
  steps: readonly StepTime[],
  at: Date,
  waiting: number,
): TimelineModel {
  const [first, ...rest] = tasks;
  const dues = tasks.map((task) => new Date(task.dueAt).getTime());
  return {
    now: first ? entryFor(first, steps, at) : null,
    next: rest.slice(0, NEXT_SHOWN).map((task) => entryFor(task, steps, at)),
    waiting,
    late: tasks.filter((task) => task.overdue).length,
    lastDue: dues.length ? new Date(Math.max(...dues)) : null,
  };
}
