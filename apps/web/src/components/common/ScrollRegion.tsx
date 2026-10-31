import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Wide or tall content that scrolls inside its own box, so the page itself
 * never scrolls sideways. When it really overflows it takes a tab stop, so a
 * keyboard user can scroll it with the arrow keys (WCAG 2.1.1); when
 * everything fits it adds no stop. It has a name for screen readers. Give it
 * a `max-h-*` class and a sticky heading row stays at the top while the rows
 * scroll.
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
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      if (
        element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight
      ) {
        element.setAttribute("tabindex", "0");
      } else {
        element.removeAttribute("tabindex");
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-label={label}
      className={cn(
        "overflow-auto rounded-xl border bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      {children}
    </div>
  );
}
