import { useSyncExternalStore } from "react";
import { useThemeStore } from "@/lib/theme";

const DARK = "(prefers-color-scheme: dark)";

function subscribeToDevice(notify: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const list = window.matchMedia(DARK);
  list.addEventListener("change", notify);
  return () => {
    list.removeEventListener("change", notify);
  };
}

function deviceIsDark(): boolean {
  return (
    typeof window.matchMedia === "function" && window.matchMedia(DARK).matches
  );
}

/**
 * Whether the page is in its dark scheme: the choice, and under "system" what
 * the device gives, which it follows when the device changes. The theme
 * switch reads it, and so does the kit's token reader.
 */
export function useIsDark(): boolean {
  const preference = useThemeStore((state) => state.preference);
  const device = useSyncExternalStore(
    subscribeToDevice,
    deviceIsDark,
    () => false,
  );
  return preference === "system" ? device : preference === "dark";
}
