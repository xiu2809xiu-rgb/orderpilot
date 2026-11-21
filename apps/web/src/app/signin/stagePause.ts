import { useSyncExternalStore } from "react";

// One Pause for everything on the sign-in page that moves by itself (WCAG
// 2.2.2): the stage, the ground behind it and the lights on the borders. The
// stage's button flips this; the rest read it, and signin.css reads the root
// attribute to hold the CSS lights.
let paused = false;
const listeners = new Set<() => void>();

export function setStagePaused(next: boolean): void {
  if (paused === next) return;
  paused = next;
  document.documentElement.toggleAttribute("data-signin-paused", next);
  listeners.forEach((listener) => {
    listener();
  });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useStagePaused(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => paused,
    () => false,
  );
}
