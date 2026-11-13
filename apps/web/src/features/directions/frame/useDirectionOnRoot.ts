import { useLayoutEffect } from "react";
import type { Direction } from "../directions";

/**
 * Puts the direction on the document element while the preview is open, so
 * dialogs, menus and toasts (drawn into the body) and every `dark:` utility
 * follow it, and takes it off again on the way out.
 */
export function useDirectionOnRoot(direction: Direction): void {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.direction = direction;
    return () => {
      delete root.dataset.direction;
    };
  }, [direction]);
}
