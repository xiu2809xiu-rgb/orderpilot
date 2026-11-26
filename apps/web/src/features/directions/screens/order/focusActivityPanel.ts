// A panel that is becoming the open one is still `hidden` for a moment, and a
// hidden element cannot take focus.
const PANEL =
  '[role="tabpanel"][data-state="active"][id$="content-activity"]:not([hidden])';
const FRAMES = 12;

/**
 * Brings the Activity tab's panel into view and focuses it once it is the open
 * one. The tab changes in the address, and React draws it a moment later, so
 * the panel is looked for on each frame, a dozen at most, and not at once.
 */
export function focusActivityPanel(): void {
  let frames = 0;
  const look = () => {
    const panel = document.querySelector<HTMLElement>(PANEL);
    if (panel) {
      // jsdom has no scrollIntoView.
      if ("scrollIntoView" in panel) panel.scrollIntoView({ block: "start" });
      panel.focus({ preventScroll: true });
      return;
    }
    frames += 1;
    if (frames < FRAMES) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}
