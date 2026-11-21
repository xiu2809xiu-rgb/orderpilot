import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme-switch"],
  });
  return () => {
    observer.disconnect();
  };
}

function snapshot(): boolean {
  return document.documentElement.dataset.themeSwitch !== undefined;
}

/**
 * True for the length of a theme change (lib/themeSwitch.ts marks the root).
 * A page change that began now would start its own view transition and end the
 * theme's circle early, so the page region swaps at once for that moment.
 */
export function useThemeSwitching(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
