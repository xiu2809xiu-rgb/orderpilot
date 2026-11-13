import { useEffect, useRef, useState, type RefObject } from "react";

/** Whether the person asked for less motion. matchMedia is missing in some test setups. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** jsdom and very old browsers have no IntersectionObserver. */
export function canObserve(): boolean {
  return typeof IntersectionObserver !== "undefined";
}

/**
 * True when an item must show its final, still state: reduced motion, or an
 * environment that cannot tell when the item is on screen (the test runner).
 * Every kit item that moves reads this, so a test sees the finished picture
 * at once and a person who asked for calm never sees a count or a fade.
 */
export function useStill(): boolean {
  const [still, setStill] = useState(
    () => prefersReducedMotion() || !canObserve(),
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setStill(query.matches || !canObserve());
    };
    update();
    query.addEventListener("change", update);
    return () => {
      query.removeEventListener("change", update);
    };
  }, []);
  return still;
}

/** Whether the element is on screen now (true where that cannot be known). */
export function useOnScreen(
  ref: RefObject<Element | null>,
  options: { once?: boolean; margin?: string } = {},
): boolean {
  const { once = false, margin = "0px" } = options;
  const [seen, setSeen] = useState(() => !canObserve());
  useEffect(() => {
    const node = ref.current;
    if (!node || !canObserve()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((entry) => entry.isIntersecting);
        if (hit && once) observer.disconnect();
        if (hit || !once) setSeen(hit);
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [ref, once, margin]);
  return seen;
}

/** Whether the tab is showing: animation loops stop while it is hidden. */
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => {
      setVisible(!document.hidden);
    };
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return visible;
}

/** The latest value in a ref, for loops that must not restart on each render. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}
