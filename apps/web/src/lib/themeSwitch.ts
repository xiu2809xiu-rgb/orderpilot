import { flushSync } from "react-dom";

/**
 * How a change of theme is shown. "reveal": a person chose it, and the new
 * theme opens from the control they used. "fade": the device changed it (the
 * choice is "system"), so there is no control to open from.
 */
export type ThemeSwitchKind = "reveal" | "fade";

interface Point {
  x: number;
  y: number;
}

/** The soft edge of the opening circle, in px: the 4rem of styles/theme-switch.css. */
const EDGE = 64;
const VARIABLES = ["--theme-x", "--theme-y", "--theme-r"] as const;

let pressed: Point | null = null;
let watching = false;
let latest = 0;

/**
 * Remembers where the last pointer press landed, so the new theme can open
 * from the control a person used. A key press forgets it: a choice made by
 * keyboard opens from the control that has focus instead. Listening on the
 * document serves every way to change the theme (the top bar, the settings
 * page, the command palette) without each of them passing a position along.
 */
export function watchThemeOrigin(): void {
  if (watching) return;
  watching = true;
  const quiet = { capture: true, passive: true };
  document.addEventListener(
    "pointerdown",
    (event) => {
      pressed = { x: event.clientX, y: event.clientY };
    },
    quiet,
  );
  document.addEventListener(
    "keydown",
    () => {
      pressed = null;
    },
    quiet,
  );
}

/** Where the new theme opens from: the press, else the focused control, else the middle. */
export function switchOrigin(): Point {
  if (pressed) return pressed;
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    const box = active.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/**
 * How far the circle must reach to cover the window from a point: the farthest
 * corner, and its soft edge beyond that so the corner ends fully covered.
 */
export function revealReach(
  origin: Point,
  width: number,
  height: number,
): number {
  return (
    Math.hypot(
      Math.max(origin.x, width - origin.x),
      Math.max(origin.y, height - origin.y),
    ) + EDGE
  );
}

function wantsLessMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Runs a change of theme inside a view transition, so the browser draws the
 * old theme and the new one together and styles/theme-switch.css animates
 * between them. Where the browser has no view transitions, or the person
 * asked for less motion, the change is made at once.
 */
export function withThemeTransition(
  change: () => void,
  kind: ThemeSwitchKind,
): void {
  if (!("startViewTransition" in document) || wantsLessMotion()) {
    change();
    return;
  }
  const root = document.documentElement;
  const mine = ++latest;
  if (kind === "reveal") {
    const origin = switchOrigin();
    const reach = revealReach(origin, window.innerWidth, window.innerHeight);
    root.style.setProperty("--theme-x", `${String(Math.round(origin.x))}px`);
    root.style.setProperty("--theme-y", `${String(Math.round(origin.y))}px`);
    root.style.setProperty("--theme-r", `${String(Math.ceil(reach))}px`);
  }
  root.dataset.themeSwitch = kind;
  const tidy = () => {
    // A newer change of theme owns the attribute and the variables now.
    if (mine !== latest) return;
    delete root.dataset.themeSwitch;
    for (const name of VARIABLES) root.style.removeProperty(name);
  };
  const transition = document.startViewTransition(() => {
    // The browser takes its picture of the new theme when this returns, so
    // what React draws from the choice has to be on the page by then.
    flushSync(change);
  });
  // A newer change of theme, or a tab in the background, skips this one. The
  // theme has changed all the same, so that is nothing to report.
  void transition.ready.catch(() => undefined);
  void transition.finished.then(tidy, tidy);
}
