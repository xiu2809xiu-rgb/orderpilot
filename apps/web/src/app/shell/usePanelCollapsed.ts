import { useCallback, useSyncExternalStore } from "react";
import { usePanelStore, type PanelPreference } from "./panelCollapsedStore";

const NARROW = "(max-width: 63.99rem)";

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
 * this browser only, as a convenience. Settings can give the choice back to
 * the window ("automatic"), so the choice is a store the bar and Settings share.
 */
export function usePanelCollapsed(): [boolean, () => void] {
  const narrow = useSyncExternalStore(subscribe, isNarrow, () => false);
  const preference = usePanelStore((state) => state.preference);
  const setPreference = usePanelStore((state) => state.setPreference);
  const collapsed = preference === "auto" ? narrow : preference === "compact";
  const toggle = useCallback(() => {
    setPreference(collapsed ? "full" : "compact");
  }, [collapsed, setPreference]);
  return [collapsed, toggle];
}

/** The choice itself: automatic, the full panel, or the rail. */
export function usePanelPreference(): [
  PanelPreference,
  (preference: PanelPreference) => void,
] {
  const preference = usePanelStore((state) => state.preference);
  const setPreference = usePanelStore((state) => state.setPreference);
  return [preference, setPreference];
}
