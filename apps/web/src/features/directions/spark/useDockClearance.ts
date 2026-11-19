import { useEffect } from "react";

/** The shell's strip at the foot of the page, where the analytics card is drawn. */
const DOCK = ".dx-dock";

/**
 * Keeps the panel from covering the strip under the page. The consent card
 * sits there on a first visit and its two buttons must stay reachable, so the
 * panel is told how tall the strip is (in a variable of its own, `--spark-dock`)
 * and ends above it. Spark can only look at the strip: it belongs to the shell.
 */
export function useDockClearance() {
  useEffect(() => {
    const root = document.documentElement;
    const dock = document.querySelector(DOCK);
    const measure = () => {
      const box = dock?.getBoundingClientRect();
      const clearance =
        box && box.height > 0 ? Math.max(0, window.innerHeight - box.top) : 0;
      root.style.setProperty(
        "--spark-dock",
        `${String(Math.round(clearance))}px`,
      );
    };
    measure();
    window.addEventListener("resize", measure);
    const watcher = dock ? new ResizeObserver(measure) : null;
    if (dock) watcher?.observe(dock);
    return () => {
      window.removeEventListener("resize", measure);
      watcher?.disconnect();
      root.style.removeProperty("--spark-dock");
    };
  }, []);
}
