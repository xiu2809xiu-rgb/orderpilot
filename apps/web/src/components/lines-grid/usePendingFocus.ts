import { useCallback, useEffect, useRef, type RefObject } from "react";
import { focusPlace } from "./gridNav";

interface Pending {
  row: number;
  /** A column kind, or null for the line itself. */
  cell: string | null;
}

/**
 * Focus that has to wait for the lines to render: a new line does not exist
 * yet when Enter adds it. `ask` says where focus goes once they have. A row
 * past the end goes to the Add line button, which is always there.
 */
export function usePendingFocus(rootRef: RefObject<HTMLElement | null>) {
  const pending = useRef<Pending | null>(null);

  // No dependencies on purpose: it checks after every render, and does nothing
  // unless something asked.
  useEffect(() => {
    const wanted = pending.current;
    const root = rootRef.current;
    if (!wanted || !root) return;
    pending.current = null;
    if (!focusPlace(root, wanted.row, wanted.cell)) {
      root.parentElement
        ?.querySelector<HTMLElement>("[data-add-line]")
        ?.focus();
    }
  });

  return useCallback((row: number, cell: string | null) => {
    pending.current = { row, cell };
  }, []);
}
