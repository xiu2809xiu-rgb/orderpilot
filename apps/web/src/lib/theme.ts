import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";

/** The same key as public/theme-init.js, which runs before first paint. */
export const THEME_KEY = "op-theme";

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // Storage can be blocked. The system theme is a fine default.
  }
  return "system";
}

function prefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(preference: ThemePreference): void {
  const dark =
    preference === "dark" || (preference === "system" && prefersDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  preference: readPreference(),
  setPreference: (preference) => {
    try {
      localStorage.setItem(THEME_KEY, preference);
    } catch {
      // The choice still applies for this visit.
    }
    applyTheme(preference);
    set({ preference });
  },
}));

/** Applies the stored theme and follows the system while the choice is "system". */
export function initTheme(): void {
  applyTheme(useThemeStore.getState().preference);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      applyTheme(useThemeStore.getState().preference);
    });
}
