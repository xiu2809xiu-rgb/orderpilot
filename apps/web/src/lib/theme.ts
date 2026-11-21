import { create } from "zustand";
import { watchThemeOrigin, withThemeTransition } from "./themeSwitch";

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

function isDark(preference: ThemePreference): boolean {
  return preference === "dark" || (preference === "system" && prefersDark());
}

export function applyTheme(preference: ThemePreference): void {
  const dark = isDark(preference);
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Whether this choice changes what is on the page. Going from "light" to
 * "system" on a light device does not, and then nothing is animated.
 */
function changesThePage(preference: ThemePreference): boolean {
  return (
    document.documentElement.classList.contains("dark") !== isDark(preference)
  );
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
    const change = () => {
      applyTheme(preference);
      set({ preference });
    };
    // A person chose it, so the new theme opens from the control they used.
    if (changesThePage(preference)) withThemeTransition(change, "reveal");
    else change();
  },
}));

/** Applies the stored theme and follows the system while the choice is "system". */
export function initTheme(): void {
  applyTheme(useThemeStore.getState().preference);
  watchThemeOrigin();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const { preference } = useThemeStore.getState();
      if (!changesThePage(preference)) return;
      // The device changed it: there is no control to open from, so it fades.
      withThemeTransition(() => {
        applyTheme(preference);
      }, "fade");
    });
}
