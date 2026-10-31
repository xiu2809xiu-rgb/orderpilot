import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wide content that scrolls sideways. When it really overflows it takes a tab
 * stop, so a keyboard user can scroll it with the arrow keys (WCAG 2.1.1);
 * when everything fits it adds no stop. It has a name for screen readers.
 */
export function ScrollRegion({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      if (element.scrollWidth > element.clientWidth) {
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
      className="overflow-x-auto rounded-xl border bg-card focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </div>
  );
}
