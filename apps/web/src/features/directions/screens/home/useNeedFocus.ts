import type { WorkflowTask } from "@orderpilot/shared";
import { useCallback, useEffect, useRef } from "react";

const ACTION = "[data-task-action]";

type Follow =
  | { kind: "next"; taskId: string; index: number }
  | { kind: "back"; taskId: string };

/**
 * When a task's row leaves, the focused button leaves with it and focus falls
 * back to the top of the page, so a keyboard user would tab through the whole
 * page for the next task. This moves focus to the next row's action, or to the
 * section's heading when the list is empty, and back to the row after an Undo.
 * It never takes focus from somewhere the person has already moved to.
 */
export function useNeedFocus(tasks: readonly WorkflowTask[] | undefined) {
  const listRef = useRef<HTMLDivElement>(null);
  const follow = useRef<Follow | null>(null);

  useEffect(() => {
    const wanted = follow.current;
    if (!wanted || !tasks) return;
    const position = tasks.findIndex((task) => task.id === wanted.taskId);
    if (wanted.kind === "next" && position >= 0) return;
    if (wanted.kind === "back" && position < 0) return;
    follow.current = null;

    const actions = listRef.current?.querySelectorAll<HTMLElement>(ACTION);
    const last = (actions?.length ?? 0) - 1;
    // The section's heading is not ours to give a ref to, so it is found from
    // the list; it takes focus only by script (tabindex -1), never by Tab.
    const heading = (): HTMLElement | null | undefined => {
      const found = listRef.current
        ?.closest("section")
        ?.querySelector<HTMLElement>("h2");
      found?.setAttribute("tabindex", "-1");
      return found;
    };
    if (wanted.kind === "back") {
      (actions?.[position] ?? heading())?.focus();
      return;
    }
    const lost =
      document.activeElement === document.body ||
      document.activeElement === null;
    if (!lost) return;
    (actions?.[Math.min(wanted.index, last)] ?? heading())?.focus();
  }, [tasks]);

  return {
    listRef,
    followNext: useCallback((task: WorkflowTask, index: number) => {
      follow.current = { kind: "next", taskId: task.id, index };
    }, []),
    followBack: useCallback((task: WorkflowTask) => {
      follow.current = { kind: "back", taskId: task.id };
    }, []),
  };
}
