import {
  Suspense,
  createContext,
  lazy,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useDemoParts } from "./demoParts";

interface SparkControl {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Whether this session has the Spark panel. */
  available: boolean;
}

const SparkContext = createContext<SparkControl>({
  open: false,
  setOpen: () => undefined,
  available: false,
});

/** Opens and closes the Spark panel, from the top bar or a page. */
export function useSparkPanel(): SparkControl {
  return useContext(SparkContext);
}

// The panel, its answers and the orb are a chunk of their own: nothing of
// Spark is downloaded until a person opens it.
const SparkPanel = lazy(() => import("@/features/directions/spark/SparkPanel"));

/** Ctrl and a full stop (Command on a Mac): not taken by Ctrl K, `/`, N or the browser. */
function isSparkKey(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key === ".";
}

/**
 * Owns whether Spark is open, and mounts the panel only after it has been
 * opened once, so its code and the orb cost nothing until a person asks for
 * them. After that the panel stays mounted (closed), so the conversation is
 * still there when it is opened again. The shortcut works on every page.
 */
export function SparkPanelProvider({ children }: { children: ReactNode }) {
  const available = useDemoParts();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const change = useCallback((next: boolean) => {
    if (next) setLoaded(true);
    setOpen(next);
  }, []);

  useEffect(() => {
    if (!available) return;
    const onKey = (event: KeyboardEvent) => {
      if (!isSparkKey(event)) return;
      event.preventDefault();
      setLoaded(true);
      setOpen((value) => !value);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [available]);

  const value = useMemo(
    () => ({ open, setOpen: change, available }),
    [open, change, available],
  );
  return (
    <SparkContext value={value}>
      {children}
      {loaded && available ? (
        <Suspense fallback={null}>
          <SparkPanel open={open} onOpenChange={change} />
        </Suspense>
      ) : null}
    </SparkContext>
  );
}
