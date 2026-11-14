import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { usePageKey } from "./pageKey";

/** How long a page may take to show its h1 before the wait for it is given up. */
const GIVE_UP_MS = 4000;
/** A record's h1 can change once its data arrives, so the name settles first. */
const SETTLE_MS = 250;

function headingOf(main: HTMLElement): string {
  return main.querySelector("h1")?.textContent.trim() ?? "";
}

/**
 * What a person who cannot see the page needs when it changes: the keyboard
 * starts at the page, the document title names it, and a polite live region
 * says its name. Returns the sentence for that region.
 *
 * The page keeps the focus it took itself (a search field, a dialog): only a
 * focus left on nothing, or on a control outside the page, moves to `main`.
 * `main` is the target of the skip link as well, so both land on one place.
 */
export function usePageArrival(main: RefObject<HTMLElement | null>): string {
  const { t } = useTranslation();
  const key = usePageKey();
  const [announcement, setAnnouncement] = useState("");
  const arrived = useRef(false);

  useEffect(() => {
    const region = main.current;
    if (!region) return;
    const first = !arrived.current;
    arrived.current = true;
    if (!first) {
      setAnnouncement("");
      const active = document.activeElement;
      if (!active || !region.contains(active)) {
        region.focus({ preventScroll: true });
      }
    }

    let settle: ReturnType<typeof setTimeout> | undefined;
    const name = () => (key === "/" ? t("nav.home") : headingOf(region));
    const publish = (final: boolean) => {
      const heading = name();
      if (!heading) return;
      document.title = t("shell.pageTitle", { page: heading });
      if (final && !first) setAnnouncement(heading);
    };
    const observer = new MutationObserver(() => {
      if (!name()) return;
      publish(false);
      clearTimeout(settle);
      settle = setTimeout(() => {
        observer.disconnect();
        publish(true);
      }, SETTLE_MS);
    });
    observer.observe(region, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    const giveUp = setTimeout(() => {
      observer.disconnect();
    }, GIVE_UP_MS);
    // The page may already be there: a chunk that was loaded before.
    if (name()) {
      publish(false);
      settle = setTimeout(() => {
        observer.disconnect();
        publish(true);
      }, SETTLE_MS);
    }
    return () => {
      observer.disconnect();
      clearTimeout(settle);
      clearTimeout(giveUp);
    };
  }, [key, main, t]);

  return announcement;
}
