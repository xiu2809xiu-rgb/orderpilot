import { useRef } from "react";

/**
 * Focus handlers for a Radix dialog that has no trigger to return to. Without
 * them focus falls to the page body when the dialog closes, and a keyboard user
 * starts again from the top of the page. The dialog remembers where focus was
 * when it opened, optionally moves focus to a safer button first, and puts it
 * back on closing.
 */
export function useRestoreFocus(initial?: () => HTMLElement | null) {
  const before = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: (event: Event) => {
      const active = document.activeElement;
      before.current = active instanceof HTMLElement ? active : null;
      const target = initial?.();
      if (target) {
        event.preventDefault();
        target.focus();
      }
    },
    onCloseAutoFocus: (event: Event) => {
      const element = before.current;
      before.current = null;
      if (element?.isConnected === true) {
        event.preventDefault();
        element.focus();
      }
    },
  };
}
