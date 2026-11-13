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
    // The app itself runs in Spectra, so leaving the preview puts back what
    // was there before it opened.
    const before = root.dataset.direction;
    root.dataset.direction = direction;
    return () => {
      if (before === undefined) delete root.dataset.direction;
      else root.dataset.direction = before;
    };
  }, [direction]);
}
