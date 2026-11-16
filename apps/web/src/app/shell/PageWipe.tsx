// Origin: Azri's "Broadcast Wipe" demo (page-wipe.css and page-wipe.js),
// with its band taken out, adapted to React Router and the shell's page key.
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { NavigationType, useMatches, useNavigationType } from "react-router";
import { recordCrumb } from "@/lib/records";
import type { CrumbHandle } from "./Breadcrumbs";
import { usePageKey } from "./pageKey";

/** One glide of the name, in milliseconds. */
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

/** The name that glides: a record's number, or else the page's own name. */
function usePageName(): string {
  const { t } = useTranslation();
  const matches = useMatches();
  const record = recordCrumb(matches);
  if (record) return record.no;
  const crumbs = matches.flatMap((match) => {
    const { crumb } = (match.handle ?? {}) as CrumbHandle;
    return crumb ? [crumb] : [];
  });
  const last = crumbs.at(-1);
  return last ? t(last) : "";
}

/** In fast, a short glide past the title, out fast, as on a race broadcast. */
const SWEEP: Keyframe[] = [
  {
    transform: "translateX(-100%)",
    offset: 0,
    easing: "cubic-bezier(0.25, 0, 0.2, 1)",
  },
  { transform: "translateX(-3%)", offset: 0.42 },
  {
    transform: "translateX(3%)",
    offset: 0.58,
    easing: "cubic-bezier(0.8, 0, 0.75, 1)",
  },
  { transform: "translateX(100%)", offset: 1 },
];

/**
 * The page-change name: when the page changes, the new page's name glides
 * across the clear strip under the top bar, to the right of the title, the way
 * a race broadcast names the camera it cuts to. It runs between the aurora and
 * the content, so it never passes over a word, takes a click or holds anything
 * up: the page has changed before it arrives. Going Home, or Back, it glides
 * the other way. It follows the page key, so a filter, a tab or a sort never
 * sets it off, and the first page opens without it. Reduced motion, or a
 * browser without the Web Animations API, shows nothing.
 */
export function PageWipe() {
  const key = usePageKey();
  const name = usePageName();
  const navigation = useNavigationType();
  const layer = useRef<HTMLDivElement>(null);
  const rider = useRef<HTMLDivElement>(null);
  const shown = useRef(key);
  const running = useRef<Animation | null>(null);

  useEffect(() => {
    if (shown.current === key) return;
    shown.current = key;
    const box = layer.current;
    const strip = rider.current;
    if (!box || !strip || reducedMotion() || !canAnimate()) return;
    // A click during a glide starts a new one; the old one simply stops.
    running.current?.cancel();
    box.dataset.on = "true";
    const back = key === "/" || navigation === NavigationType.Pop;
    const animation = strip.animate(SWEEP, {
      duration: WIPE_MS,
      direction: back ? "reverse" : "normal",
    });
    running.current = animation;
    void animation.finished.then(
      () => {
        if (running.current !== animation) return;
        box.dataset.on = "false";
        running.current = null;
      },
      // Cancelled by a newer glide, which now owns the name.
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
      <div ref={rider} className="dx-wipe-rider">
        <span className="dx-wipe-name">{name}</span>
      </div>
    </div>,
    document.body,
  );
}
