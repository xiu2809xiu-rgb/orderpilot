import { useSyncExternalStore } from "react";

/** False while the tab is in the background, so decoration can pause. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    (notify) => {
      document.addEventListener("visibilitychange", notify);
      return () => {
        document.removeEventListener("visibilitychange", notify);
      };
    },
    () => document.visibilityState !== "hidden",
    () => true,
  );
}
