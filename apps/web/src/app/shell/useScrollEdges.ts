import { useEffect, useRef, useState } from "react";

/** Whether an element has more content hidden above and below, to fade that edge. */
export function useScrollEdges<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [edges, setEdges] = useState({ above: false, below: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const above = el.scrollTop > 1;
      const below = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      setEdges((old) =>
        old.above === above && old.below === below ? old : { above, below },
      );
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    // jsdom has no ResizeObserver, and its boxes are empty anyway.
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(measure);
    observer?.observe(el);
    if (el.firstElementChild) observer?.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, []);

  return { ref, ...edges };
}
