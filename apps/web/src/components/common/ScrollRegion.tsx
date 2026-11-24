import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { moreSides } from "./scrollEdges";
import "./ScrollRegion.css";

/**
 * Wide or tall content that scrolls inside its own box, so the page itself
 * never scrolls sideways. When it really overflows it takes a tab stop, so a
 * keyboard user can scroll it with the arrow keys (WCAG 2.1.1); when
 * everything fits it adds no stop. It has a name for screen readers. Give it
 * a `max-h-*` class and a sticky heading row stays at the top while the rows
 * scroll. A quiet mark on the left or right edge shows which side has more
 * (see ScrollRegion.css); it is decoration and takes no click.
 */
export function ScrollRegion({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const edgesRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    const edges = edgesRef.current;
    if (!element || !edges) return;

    const flag = (name: string, on: boolean) => {
      if (element.hasAttribute(name) !== on) element.toggleAttribute(name, on);
    };
    const sync = () => {
      const { start, end } = moreSides(element);
      flag("data-more-start", start);
      flag("data-more-end", end);
    };
    const measure = () => {
      // The rail is as large as the scroll area, so left in place it would
      // hold that area open after the content shrinks, and its frames are
      // as large as the old visible box. Collapse both, then read.
      edges.style.width = "0px";
      edges.style.height = "0px";
      element.style.setProperty("--sr-client-w", "0px");
      element.style.setProperty("--sr-client-h", "0px");
      const { scrollWidth, scrollHeight, clientWidth, clientHeight } = element;
      if (scrollWidth > clientWidth || scrollHeight > clientHeight) {
        element.setAttribute("tabindex", "0");
      } else {
        element.removeAttribute("tabindex");
      }
      edges.style.width = `${String(scrollWidth)}px`;
      edges.style.height = `${String(scrollHeight)}px`;
      element.style.setProperty("--sr-client-w", `${String(clientWidth)}px`);
      element.style.setProperty("--sr-client-h", `${String(clientHeight)}px`);
      sync();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    // The content is the first child: the rail is the last, so it is not it.
    const content = element.firstElementChild;
    if (content && content !== edges) observer.observe(content);
    element.addEventListener("scroll", sync, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", sync);
    };
  }, []);

  // `relative` keeps an sr-only span (absolutely positioned) inside the clip:
  // without it the span escapes the region and the whole page scrolls sideways.
  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      className={cn("sr-region overflow-auto", className)}
    >
      {children}
      <span ref={edgesRef} className="sr-edges" aria-hidden="true" />
    </div>
  );
}
