import { useEffect, useState } from "react";

/** Radix renders an open menu, such as Demo role's, with this role and state. */
const OPEN_MENU = '[role="menu"][data-state="open"]';

/**
 * Where an open dropdown menu is on screen, or null. The tour's card moves out
 * of its way, so the presenter can pick a role without the card on top of the
 * list. It hears the moment a menu opens or closes, and measures again on a
 * short beat, because a menu is placed only after it opens.
 */
export function useOpenMenu(): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const measure = () => {
      const menu = document.querySelector(OPEN_MENU);
      const next = menu ? menu.getBoundingClientRect() : null;
      setRect((previous) =>
        previous?.left === next?.left &&
        previous?.top === next?.top &&
        previous?.height === next?.height
          ? previous
          : next,
      );
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    const timer = window.setInterval(measure, 150);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, []);
  return rect;
}
