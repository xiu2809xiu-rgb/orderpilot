import { lazy, Suspense } from "react";
import { QuietBoundary } from "./QuietBoundary";
import { useMediaQuery } from "./useMediaQuery";

// Its own chunk: the form never waits for the animation.
const OrderFlow = lazy(() =>
  import("./OrderFlow").then((module) => ({ default: module.OrderFlow })),
);

/**
 * Where the order flow goes. On a phone it is not loaded at all: the promise
 * shows as text only. Any failure inside it leaves a blank space, not an error.
 */
export function FlowSlot() {
  const roomy = useMediaQuery("(min-width: 768px)");
  if (!roomy) return null;
  return (
    <div
      aria-hidden="true"
      className="aspect-[12/5] w-full rounded-xl bg-card shadow-card"
    >
      <QuietBoundary>
        <Suspense fallback={null}>
          <OrderFlow />
        </Suspense>
      </QuietBoundary>
    </div>
  );
}
