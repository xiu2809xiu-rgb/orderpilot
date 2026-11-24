import { create } from "zustand";

/** The same key as before the store: "1" is the rail, "0" the full panel, absent is automatic. */
export const PANEL_KEY = "op-dx-panel-collapsed";

export type PanelPreference = "auto" | "full" | "compact";

function read(): PanelPreference {
  try {
    const stored = window.localStorage.getItem(PANEL_KEY);
    if (stored === "1") return "compact";
    if (stored === "0") return "full";
  } catch {
    // Storage can be blocked: the panel then follows the window.
  }
  return "auto";
}

function write(preference: PanelPreference): void {
  try {
    if (preference === "auto") window.localStorage.removeItem(PANEL_KEY);
    else
      window.localStorage.setItem(
        PANEL_KEY,
        preference === "compact" ? "1" : "0",
      );
  } catch {
    // The choice then lasts until the page is closed.
  }
}

interface PanelState {
  preference: PanelPreference;
  setPreference: (preference: PanelPreference) => void;
}

/**
 * How the side panel is shown, kept in one place so that the bar's toggle and
 * the Settings page always agree. Remembered in this browser only.
 */
export const usePanelStore = create<PanelState>()((set) => ({
  preference: read(),
  setPreference: (preference) => {
    write(preference);
    set({ preference });
  },
}));
