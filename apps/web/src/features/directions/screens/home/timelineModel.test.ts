import type { WorkflowTask } from "@orderpilot/shared";
import { describe, expect, it } from "vitest";
import { STEP_TIMES } from "../../data/index";
import { buildTimeline } from "./timelineModel";

const AT = new Date("2026-11-13T06:00:00.000Z");

function task(
  id: string,
  kind: WorkflowTask["kind"],
  createdAt: string,
  dueAt: string,
  overdue = false,
): WorkflowTask {
  return {
    id,
    kind,
    title: id,
    assigneeRole: "SUPPORT",
    orderNo: id,
    ref: null,
    status: "OPEN",
    createdAt,
    dueAt,
    overdue,
  };
}

describe("buildTimeline", () => {
  const tasks = [
    task(
      "SO-1",
      "SEND_PI",
      "2026-11-08T07:00:00.000Z",
      "2026-11-11T09:00:00.000Z",
      true,
    ),
    task(
      "SO-2",
      "REVIEW_FIELDS",
      "2026-11-13T03:00:00.000Z",
      "2026-11-14T09:00:00.000Z",
    ),
    task(
      "SO-3",
      "ADD_SHIPPING_DOCUMENTS",
      "2026-11-12T03:00:00.000Z",
      "2026-11-16T09:00:00.000Z",
    ),
  ];
  const model = buildTimeline(tasks, STEP_TIMES.sales, AT, 3);

  it("puts the first task in hand and the rest next, in the same order", () => {
    expect(model.now?.task.id).toBe("SO-1");
    expect(model.next.map((entry) => entry.task.id)).toEqual(["SO-2", "SO-3"]);
  });

  it("totals every open task: how many wait, how many are late, the last due time", () => {
    expect(model.waiting).toBe(3);
    expect(model.late).toBe(1);
    expect(model.lastDue?.toISOString()).toBe("2026-11-16T09:00:00.000Z");
  });

  it("takes the usual time from the measured median of the task's step", () => {
    // The PI step took a median of 1 day on the data set, so a task made on
    // 8 Nov is expected by 9 Nov and is long past it on 13 Nov.
    expect(model.now?.stepId).toBe("pi");
    expect(model.now?.position).toBe(3);
    expect(model.now?.usual).toEqual({ kind: "days", amount: 1 });
    expect(model.now?.expected?.at.toISOString()).toBe(
      "2026-11-09T07:00:00.000Z",
    );
    expect(model.now?.pastUsual).toBe(true);
  });

  it("is not past the usual time while the wait is shorter than it", () => {
    // PO review: median 1 day, made at 03:00 on 13 Nov, now 06:00 the same day.
    expect(model.next[0]?.stepId).toBe("poIn");
    expect(model.next[0]?.pastUsual).toBe(false);
  });

  it("gives no number for a step the data cannot time", () => {
    const entry = model.next[1];
    expect(entry?.stepId).toBe("documents");
    expect(entry?.usual).toBeNull();
    expect(entry?.expected).toBeNull();
    expect(entry?.pastUsual).toBeNull();
  });

  it("is empty with no tasks", () => {
    const empty = buildTimeline([], STEP_TIMES.sales, AT, 0);
    expect(empty.now).toBeNull();
    expect(empty.next).toEqual([]);
    expect(empty.lastDue).toBeNull();
  });
});
