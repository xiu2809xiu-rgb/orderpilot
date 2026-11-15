import type { ReactNode } from "react";

interface HomeRowProps {
  /** What it is, in a few words. */
  title: ReactNode;
  /** The record as a link, with what identifies it. */
  meta: ReactNode;
  /** The date or the timer, and any figure that goes with it. */
  trailing?: ReactNode;
  /** The row's one action. */
  action?: ReactNode;
}

/**
 * One row of a "needs you" list, the same for tasks, overdue orders, refused
 * actions and open rules: what it is, the record, when, and one action. The
 * list divides the rows, not the row itself, because a list that animates
 * wraps each row. The action has a column of its own so the buttons line up
 * down the list; on a phone each part takes a line of its own, so a customer's
 * name and an amount are never cut to make room for each other.
 */
export function HomeRow({ title, meta, trailing, action }: HomeRowProps) {
  return (
    <div className="grid grid-cols-1 items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto_8.5rem]">
      <div className="min-w-0">
        <p className="fs-14 font-medium text-foreground">{title}</p>
        <div className="fs-14 flex min-w-0 items-baseline gap-x-2 text-muted-foreground">
          {meta}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:flex-col sm:items-end sm:justify-self-end">
        {trailing}
      </div>
      <div className="flex sm:justify-end">{action}</div>
    </div>
  );
}
