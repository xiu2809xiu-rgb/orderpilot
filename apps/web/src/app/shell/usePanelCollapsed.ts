import { useCallback, useState, useSyncExternalStore } from "react";

const KEY = "op-dx-panel-collapsed";
const NARROW = "(max-width: 63.99rem)";

function read(): boolean | null {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === null ? null : stored === "1";
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function isNarrow(): boolean {
  return (
    typeof window.matchMedia === "function" && window.matchMedia(NARROW).matches
  );
}

/**
 * Whether the panel is the 64 px rail. Below 1024 px it starts as the rail,
 * because at 820 px the full 268 px panel leaves the page about 520 px. Once
 * the person chooses, their choice wins at every width and is remembered in
 * this browser only, as a convenience.
 */
export function usePanelCollapsed(): [boolean, () => void] {
  const narrow = useSyncExternalStore(subscribe, isNarrow, () => false);
  const [choice, setChoice] = useState<boolean | null>(read);
  const collapsed = choice ?? narrow;
  const toggle = useCallback(() => {
    const next = !collapsed;
    setChoice(next);
    try {
      window.localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      // The choice then lasts until the page is closed.
    }
  }, [collapsed]);
  return [collapsed, toggle];
}
