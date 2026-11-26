const FRAMES = 12;

/**
 * Brings one tab's panel into view and focuses it once it is the open one.
 * The tab changes in the address and React draws it a moment later, and a
 * panel that is becoming the open one is still `hidden` for a moment, which
 * cannot take focus: so the panel is looked for on each frame, a dozen at
 * most, and not at once.
 */
export function focusTabPanel(tab: string): void {
  const panel = `[role="tabpanel"][data-state="active"][id$="content-${tab}"]:not([hidden])`;
  let frames = 0;
  const look = () => {
    const found = document.querySelector<HTMLElement>(panel);
    if (found) {
      // jsdom has no scrollIntoView.
      if ("scrollIntoView" in found) found.scrollIntoView({ block: "start" });
      found.focus({ preventScroll: true });
      return;
    }
    frames += 1;
    if (frames < FRAMES) requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
}
