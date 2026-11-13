import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SPARK_PANEL } from "../screens";

interface SparkControl {
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Whether the Spark panel exists in this preview. */
  available: boolean;
}

const SparkContext = createContext<SparkControl>({
  open: false,
  setOpen: () => undefined,
  available: false,
});

/** Opens and closes the Spark panel, from the top bar or a screen. */
export function useSparkPanel(): SparkControl {
  return useContext(SparkContext);
}

/** Ctrl and a full stop (Command on a Mac): not taken by Ctrl K, `/`, N or the browser. */
function isSparkKey(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key === ".";
}

/**
 * Owns whether Spark is open, and mounts the panel only after it has been
 * opened once, so its code and the orb cost nothing until a person asks for
 * them. After that the panel stays mounted (closed), so the conversation is
 * still there when it is opened again. The shortcut works on every screen.
 */
export function SparkPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const change = useCallback((next: boolean) => {
    if (next) setLoaded(true);
    setOpen(next);
  }, []);

  useEffect(() => {
    if (!SPARK_PANEL) return;
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
  }, []);

  const value = useMemo(
    () => ({ open, setOpen: change, available: SPARK_PANEL !== null }),
    [open, change],
  );
  const Panel = SPARK_PANEL;
  return (
    <SparkContext value={value}>
      {children}
      {loaded && Panel ? (
        <Suspense fallback={null}>
          <Panel open={open} onOpenChange={change} />
        </Suspense>
      ) : null}
    </SparkContext>
  );
}
