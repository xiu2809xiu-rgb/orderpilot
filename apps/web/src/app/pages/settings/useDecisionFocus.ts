import { useEffect, useRef } from "react";

/**
 * Where focus goes after a decision takes a row out of the list: the first
 * button of the row that took its place, or the panel heading when none is
 * left. A keyboard user would otherwise start again from the top of the page.
 * The move waits until the decided picture is really gone from the list, and
 * until the dialog that asked for the decision has closed.
 */
export function useDecisionFocus(ids: readonly string[]) {
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const planned = useRef<{ id: string; index: number } | null>(null);
  const current = useRef(ids);

  /** "none": no decision waits for focus. "waiting": the picture is still listed. */
  function settle(): "none" | "waiting" | "moved" {
    const plan = planned.current;
    if (!plan) return "none";
    if (current.current.includes(plan.id)) return "waiting";
    planned.current = null;
    const rows = list.current?.querySelectorAll<HTMLElement>(":scope > li");
    const row = rows?.[Math.min(plan.index, (rows.length || 1) - 1)];
    const target =
      row?.querySelector<HTMLElement>("button:not([disabled])") ??
      root.current?.querySelector<HTMLElement>("h2");
    if (target?.tagName === "H2") target.tabIndex = -1;
    target?.focus();
    return "moved";
  }

  useEffect(() => {
    current.current = ids;
    settle();
  });

  return {
    root,
    list,
    /** Call when a decision was made on the row at `index`. */
    remember: (id: string, index: number) => {
      planned.current = { id, index };
    },
    /** Call when a dialog has closed. */
    settle,
  };
}
