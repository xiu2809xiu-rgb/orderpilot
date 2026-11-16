import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { prefersReducedMotion } from "@/components/kit/env";

/** The most rings alive at once: a burst of presses never piles up elements. */
const MOST = 6;
/** A ring that never hears its animation end (a hidden tab) still leaves. */
const LEAVE_MS = 900;

/**
 * A soft ring where the pointer pressed, so the page answers every click, even
 * on a thing that has no pressed look of its own. It is decoration: its layer
 * takes no pointer events, is hidden from assistive technology and sits in the
 * body, above menus and dialogs. A ring is one element that removes itself;
 * nothing here is React state, so a press renders nothing again. Only the main
 * button and the first finger draw one (the keyboard has the focus ring), and
 * a person who asked for less motion gets none.
 */
export function ClickPulse() {
  const layer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = layer.current;
    if (!node) return;
    const press = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      if (prefersReducedMotion()) return;
      while (node.childElementCount >= MOST) node.firstElementChild?.remove();
      const ring = document.createElement("span");
      ring.className = "click-pulse";
      ring.style.left = `${String(event.clientX)}px`;
      ring.style.top = `${String(event.clientY)}px`;
      const leave = () => {
        ring.remove();
      };
      ring.addEventListener("animationend", leave, { once: true });
      window.setTimeout(leave, LEAVE_MS);
      node.append(ring);
    };
    // Capture: a control that stops the event from bubbling is still answered.
    const options = { capture: true, passive: true };
    window.addEventListener("pointerdown", press, options);
    return () => {
      window.removeEventListener("pointerdown", press, options);
      node.replaceChildren();
    };
  }, []);

  return createPortal(
    <div ref={layer} aria-hidden="true" className="click-pulse-layer" />,
    document.body,
  );
}
