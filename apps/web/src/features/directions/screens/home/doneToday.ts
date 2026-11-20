import { taskKindSchema, type WorkflowTask } from "@orderpilot/shared";
import { z } from "zod";
import { todayInSingapore } from "@/lib/format";

/** A task the person finished today, from Home or from an order's page. */
export interface DoneItem {
  kind: z.infer<typeof taskKindSchema>;
  orderNo: string;
  /** Kept so the list still names the customer after a reload; the task is gone from the API by then. */
  customerName: string | null;
  at: Date;
}

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

/** What the person finished today (Singapore), newest first. Another day's entries are dropped. */
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
    return parsed.data
      .map((entry) => ({ ...entry, at: new Date(entry.at) }))
      .filter((entry) => todayInSingapore(entry.at) === today);
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
  task: WorkflowTask,
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
  task: WorkflowTask,
): DoneItem[] {
  const before = readDone(viewerId);
  if (!viewerId) return before;
  const at = before.findIndex(
    (item) => item.kind === task.kind && item.orderNo === task.orderNo,
  );
  if (at === -1) return before;
  const items = before.filter((_, index) => index !== at);
  write(viewerId, items);
  return items;
}
