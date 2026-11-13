import { useThemeStore } from "@/lib/theme";

/** Whether the page is in its dark scheme, following the system while the choice is "system". */
export function useIsDark(): boolean {
  const preference = useThemeStore((state) => state.preference);
  if (preference === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  return preference === "dark";
}
