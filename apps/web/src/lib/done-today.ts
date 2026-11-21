import { taskKindSchema, type WorkflowTask } from "@orderpilot/shared";
import { z } from "zod";
import { useSessionStore } from "@/stores/session";
import { todayInSingapore } from "./format";

/**
 * A task the person finished today: from a button on Home or on an order's
 * page, or from a form of another area through `recordFinishedTask`.
 */
export interface DoneItem {
  kind: z.infer<typeof taskKindSchema>;
  orderNo: string;
  /** Kept so the list still names the customer after a reload; the task is gone from the API by then. */
  customerName: string | null;
  at: Date;
}

/** What a note of a finished task needs of the task. */
export type FinishedTask = Pick<
  WorkflowTask,
  "kind" | "orderNo" | "customerName"
>;

/** Enough for a day's work; the list shows what was done, it is not an archive. */
const MAX_ITEMS = 50;

const storedSchema = z
  .array(
    z.object({
      kind: taskKindSchema,
      orderNo: z.string().min(1),
      customerName: z.string().nullable().default(null),
      at: z.iso.datetime(),
    }),
  )
  .max(MAX_ITEMS);

/**
 * One list per signed-in person, kept in the browser like the strip of open
 * records (ADR 0032): a convenience, not business data. The API lists only open
 * tasks, so this is the only memory of what a person finished.
 */
export function doneKey(viewerId: string): string {
  return `op.done.${viewerId}`;
}

/** What the person finished today (Singapore), newest first. Another day's entries are dropped, and from the browser too. */
export function readDone(
  viewerId: string | null,
  now = new Date(),
): DoneItem[] {
  if (!viewerId) return [];
  try {
    const raw = localStorage.getItem(doneKey(viewerId));
    if (!raw) return [];
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return [];
    const today = todayInSingapore(now);
    const kept = parsed.data
      .map((entry) => ({ ...entry, at: new Date(entry.at) }))
      .filter((entry) => todayInSingapore(entry.at) === today);
    // Another day's order numbers and customer names are not kept in the
    // browser for a write that may never come, so the cleaned list goes back.
    if (kept.length < parsed.data.length) write(viewerId, kept);
    return kept;
  } catch {
    // Blocked storage or a broken copy: start with an empty list. Nothing else depends on it.
    return [];
  }
}

function write(viewerId: string, items: readonly DoneItem[]): void {
  try {
    localStorage.setItem(
      doneKey(viewerId),
      JSON.stringify(
        items.map((item) => ({ ...item, at: item.at.toISOString() })),
      ),
    );
  } catch {
    // Not kept this time. The list on screen still shows it until the page reloads.
  }
}

/**
 * Notes a finished task, newest first. A task with no order (every kind a
 * person can finish has one) is not noted: the list is of orders.
 */
export function recordDone(
  viewerId: string | null,
  task: FinishedTask,
  at: Date,
): DoneItem[] {
  const before = readDone(viewerId, at);
  if (!viewerId || !task.orderNo) return before;
  const items = [
    {
      kind: task.kind,
      orderNo: task.orderNo,
      customerName: task.customerName ?? null,
      at,
    },
    ...before,
  ].slice(0, MAX_ITEMS);
  write(viewerId, items);
  return items;
}

/** Takes the newest note of this task back out, after an Undo. */
export function forgetDone(
  viewerId: string | null,
  task: FinishedTask,
  now = new Date(),
): DoneItem[] {
  const before = readDone(viewerId, now);
  if (!viewerId) return before;
  const at = before.findIndex(
    (item) => item.kind === task.kind && item.orderNo === task.orderNo,
  );
  if (at === -1) return before;
  const items = before.filter((_, index) => index !== at);
  write(viewerId, items);
  return items;
}

/**
 * For a form that finishes a task itself, such as the workflow's payment form
 * or an SPR decision: notes the task for the signed-in person with one call, so
 * it is listed in Done today when Home opens next. Nothing to subscribe to and
 * nothing to undo here. Call it once the server has accepted the act.
 *
 *   recordFinishedTask({ kind: "CONFIRM_PAYMENT", orderNo: "SO-0062", customerName: "Alpha Traders" });
 */
export function recordFinishedTask(
  task: FinishedTask,
  at: Date = new Date(),
): void {
  const viewerId = useSessionStore.getState().session?.user.id ?? null;
  recordDone(viewerId, task, at);
}
