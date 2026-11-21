import {
  Suspense,
  lazy,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useHoverTip } from "@/components/common/useHoverTip";
import { cn } from "@/lib/utils";

// The tip is the one the top bar's Upload and Spark buttons use, and like it
// is a chunk of its own, so the entry bundle does not carry it.
const HintTipBody = lazy(() => import("@/app/shell/HintTipBody"));

const TOUCH = "(pointer: coarse)";

function subscribe(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => undefined;
  const query = window.matchMedia(TOUCH);
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

const isTouch = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia(TOUCH).matches;

/**
 * Shows what a task button does, and does not do, as a tip on hover and on
 * keyboard focus: the line a screen reader already hears as the button's
 * description, so a sighted person is told too. The button keeps that
 * description as it is; this adds the tip beside it and nothing to the
 * description, so a screen reader hears the line once. The wrapper is the
 * button's own box (it takes the button's width classes), and the tip is an
 * overlay, so the row's layout does not change. A touch screen has no hover and
 * its first tap does the task, so it gets no tip.
 */
export function TaskTip({
  hint,
  enabled = true,
  className,
  children,
}: {
  hint: string;
  /** False for a button with no line of its own: it is left as it is. */
  enabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <TipBox hint={hint} className={className}>
      {children}
    </TipBox>
  );
}

// Its own component so the hover and focus listeners are attached by an effect
// that runs where the wrapper exists. One TaskTip instance can go from not
// enabled to enabled (the order page keeps one across tasks), and a hook in
// TaskTip itself would have run its effect while there was no wrapper to
// listen on, and never again.
function TipBox({
  hint,
  className,
  children,
}: {
  hint: string;
  className?: string;
  children: ReactNode;
}) {
  const box = useRef<HTMLSpanElement>(null);
  const tip = useHoverTip(box, { holdsFocus: true });
  const touch = useSyncExternalStore(subscribe, isTouch, () => false);
  return (
    <span ref={box} className={cn("relative inline-flex", className)}>
      {children}
      {touch ? null : (
        <Suspense fallback={null}>
          <HintTipBody
            hint={hint}
            open={tip.open}
            onOpenChange={(open) => {
              if (!open) tip.close();
            }}
            onPointerEnter={tip.enter}
            onPointerLeave={tip.leave}
          />
        </Suspense>
      )}
    </span>
  );
}
