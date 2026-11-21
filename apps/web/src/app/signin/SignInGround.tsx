import { lazy, Suspense, useEffect, useState } from "react";
import { QuietBoundary } from "./QuietBoundary";
import { useStagePaused } from "./stagePause";

// Its own chunk: the shader and its canvas never load with the form.
const Aurora = lazy(() =>
  import("@/components/kit/Aurora").then((module) => ({
    default: module.Aurora,
  })),
);

/** Runs `start` when the browser is idle, or soon after where it has no idle callback. */
function whenIdle(start: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(start, { timeout: 1200 });
    return () => {
      window.cancelIdleCallback(id);
    };
  }
  const id = window.setTimeout(start, 200);
  return () => {
    window.clearTimeout(id);
  };
}

/**
 * The picture behind the page: the aurora, drifting slowly, over two soft drifting lights. It is decoration
 * with no text. The page's own ground (a CSS gradient on the body) is there
 * from the first paint; this canvas fades in over it once the form is
 * interactive, and a failure to load it leaves that ground as it is. Under
 * reduced motion it draws one still frame.
 */
export function SignInGround() {
  const [ready, setReady] = useState(false);
  const paused = useStagePaused();
  useEffect(
    () =>
      whenIdle(() => {
        setReady(true);
      }),
    [],
  );
  return (
    <div
      aria-hidden="true"
      className="signin-ground pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      {/* A second, slower layer of depth under the aurora: two soft lights that drift. Plain CSS, held by Pause and by reduced motion. */}
      <span className="signin-orb signin-orb-a" />
      <span className="signin-orb signin-orb-b" />
      {ready ? (
        <QuietBoundary>
          <Suspense fallback={null}>
            <Aurora height={0.42} opacity={0.4} paused={paused} />
          </Suspense>
        </QuietBoundary>
      ) : null}
    </div>
  );
}
