import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TourTarget } from "./tourSteps";

/** How long a step waits for its button before it offers to skip it. */
export const TARGET_WAIT_MS = 8000;
const POLL_MS = 150;

/** The element a target names, or null while the page has not drawn it. */
export function findTarget(target: TourTarget, t: TFunction): Element | null {
  if (target.kind === "none") return null;
  if (target.kind === "selector")
    return document.querySelector(target.selector);
  const words = target.text(t).trim();
  const heading = [
    ...document.querySelectorAll("main h1, main h2, main h3"),
  ].find((element) => element.textContent.trim() === words);
  if (!heading) return null;
  return heading.closest("section, [data-slot=card]") ?? heading.parentElement;
}

export interface TargetState {
  element: Element | null;
  rect: DOMRect | null;
  /** True once the wait is over and the target never appeared. */
  missing: boolean;
}

/**
 * Finds a step's target and follows it: a page loads, scrolls and changes its
 * layout under the light, so the box is measured again on a short beat. The
 * target is scrolled into view once, when it first appears.
 */
export function useTourTarget(target: TourTarget): TargetState {
  const { t } = useTranslation();
  const [state, setState] = useState<TargetState>({
    element: null,
    rect: null,
    missing: false,
  });

  useEffect(() => {
    setState({ element: null, rect: null, missing: false });
    if (target.kind === "none") return;
    const started = Date.now();
    let shown: Element | null = null;
    const tick = () => {
      const element = findTarget(target, t);
      if (element && element !== shown) {
        shown = element;
        element.scrollIntoView({ block: "center", inline: "nearest" });
      }
      setState({
        element,
        rect: element ? element.getBoundingClientRect() : null,
        missing: !element && Date.now() - started > TARGET_WAIT_MS,
      });
    };
    tick();
    const timer = window.setInterval(tick, POLL_MS);
    return () => {
      window.clearInterval(timer);
    };
    // Each step's target is a fixed object, so a new step means a new search.
  }, [target, t]);

  return state;
}
