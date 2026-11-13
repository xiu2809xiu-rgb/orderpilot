import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * The tag that says a prototype screen is not a real page yet. It has no
 * switch of any kind: the screen is shown in the product's one design.
 */
export function PreviewBar() {
  const { t } = useTranslation("directions");
  const bar = useRef<HTMLDivElement>(null);

  // Spark's panel sits below this bar, so the tag is never covered.
  useEffect(() => {
    const node = bar.current;
    if (!node) return;
    const root = document.documentElement;
    const write = () => {
      root.style.setProperty("--dx-chrome-h", `${String(node.offsetHeight)}px`);
    };
    write();
    if (typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(write);
    watch.observe(node);
    return () => {
      watch.disconnect();
      root.style.removeProperty("--dx-chrome-h");
    };
  }, []);

  return (
    <div
      ref={bar}
      className="flex shrink-0 items-center justify-center px-3 pt-2"
    >
      <p className="dx-panel-strong fs-14 rounded-full px-4 py-0.5 font-medium text-foreground">
        {t("preview.tag")}
      </p>
    </div>
  );
}
