// Origin: Azri's "Broadcast Wipe" demo (page-wipe.css and page-wipe.js),
// adapted to React Router, the Spectra tokens and the shell's page key.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { NavigationType, useNavigationType } from "react-router";
import { usePageKey } from "./pageKey";

/** One pass of the stripes, in milliseconds. */
export const WIPE_MS = 850;

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function canAnimate(): boolean {
  return typeof Element.prototype.animate === "function";
}

/** In fast, a short glide across the middle, out fast, as on a race broadcast. */
function sweep(skew: string): Keyframe[] {
  const at = (x: string) => `translateX(${x}) skewX(${skew})`;
  return [
    {
      transform: at("-100%"),
      offset: 0,
      easing: "cubic-bezier(0.25, 0, 0.2, 1)",
    },
    { transform: at("-3%"), offset: 0.42 },
    {
      transform: at("3%"),
      offset: 0.58,
      easing: "cubic-bezier(0.8, 0, 0.75, 1)",
    },
    { transform: at("100%"), offset: 1 },
  ];
}

/**
 * The broadcast wipe: when the page changes, two slanted teal stripes sweep
 * across the screen, the way a race broadcast cuts between cameras. The page
 * itself changes at once and stays usable: the stripes never take a click,
 * and they pass under any dialog. Going Home, or Back, sweeps the other way.
 * It follows the page key, so a filter, a tab or a sort never sets it off, and
 * the first page opens without it. Reduced motion, or a browser without the Web
 * Animations API, shows no stripes at all.
 */
export function PageWipe() {
  const key = usePageKey();
  const navigation = useNavigationType();
  const layer = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const shown = useRef(key);
  const running = useRef<Animation | null>(null);

  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    const box = layer.current;
    const slab = band.current;
    if (!box || !slab || reducedMotion() || !canAnimate()) return;
    // A click during a sweep starts a new one; the old one simply stops.
    running.current?.cancel();
    box.dataset.reverse = String(
      key === "/" || navigation === NavigationType.Pop,
    );
    box.dataset.on = "true";
    const skew =
      getComputedStyle(box).getPropertyValue("--wipe-skew").trim() || "-14deg";
    const animation = slab.animate(sweep(skew), { duration: WIPE_MS });
    running.current = animation;
    void animation.finished.then(
      () => {
        if (running.current !== animation) return;
        box.dataset.on = "false";
        running.current = null;
      },
      // Cancelled by a newer sweep, which now owns the stripes.
      () => undefined,
    );
  }, [key, navigation]);

  useEffect(
    () => () => {
      running.current?.cancel();
    },
    [],
  );

  return createPortal(
    <div ref={layer} className="dx-wipe" data-on="false" aria-hidden="true">
      <div className="dx-wipe-track">
        <div ref={band} className="dx-wipe-slab" />
      </div>
    </div>,
    document.body,
  );
}
