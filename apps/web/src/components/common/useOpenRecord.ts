import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { loadRecordTabs } from "@/lib/loadRecordTabs";
import { resolveRecord } from "@/lib/records";

/** How a person asked to open something. */
export type OpenGesture = "plain" | "background" | "browser";

interface PointerLike {
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Ctrl+click, Command+click and a middle click open a record in a background
 * tab of our strip. Shift and Alt keep their browser meaning (a new window, a
 * download), and so does any other button.
 */
export function gestureOf(event: PointerLike): OpenGesture {
  if (event.button === 1) return "background";
  if (event.button !== 0) return "browser";
  if (event.ctrlKey || event.metaKey) return "background";
  if (event.shiftKey || event.altKey) return "browser";
  return "plain";
}

/**
 * Returns a function that opens a record for a click. It answers true when it
 * has taken the click, so the caller stops the browser's own handling; false
 * leaves the click alone (not a record page, or a Shift or Alt click).
 *
 * The tab logic loads on first use. The strip's code is a separate download
 * that starts with the shell, so by the first click it is already there.
 */
export function useOpenRecord(): (to: string, gesture: OpenGesture) => boolean {
  const navigate = useNavigate();
  // Not useMatches: a link also renders under a plain MemoryRouter in tests.
  const { pathname } = useLocation();

  return useCallback(
    (to, gesture) => {
      if (gesture === "browser" || !resolveRecord(to)) return false;
      loadRecordTabs().then(
        ({ openRecord }) => {
          if (openRecord(to, gesture, pathname) === "go") return navigate(to);
        },
        // The tab logic could not load: the record still opens, just without a tab.
        () => navigate(to),
      );
      return true;
    },
    [navigate, pathname],
  );
}
