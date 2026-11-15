import { Suspense, ViewTransition } from "react";
import { Outlet } from "react-router";
import { InShellContext } from "./inShell";
import { usePageKey } from "./pageKey";
import { RouteSkeleton } from "./skeletons/RouteSkeleton";
import { useThemeSwitching } from "./useThemeSwitching";

/**
 * Where a page is drawn. Only this region animates when the page changes:
 * a view transition named "dx-page" (styles/motion.css), with the panel and the
 * bar standing still. It is keyed by the path alone (`pageKey`), so a filter,
 * a tab, a sort or the side peek, which change the query string, never move it,
 * and nothing inside a page ever animates as a page change. React leaves the
 * change instant where the browser has no view transitions, and motion.css
 * switches the animation off under reduced motion.
 */
export function PageRegion() {
  const key = usePageKey();
  // A theme change owns the view transition for its length; see the hook.
  const motion = useThemeSwitching() ? "none" : "dx-page";
  return (
    <ViewTransition key={key} default="none" enter={motion} exit={motion}>
      <div>
        <InShellContext value={true}>
          <Suspense fallback={<RouteSkeleton />}>
            <Outlet />
          </Suspense>
        </InShellContext>
      </div>
    </ViewTransition>
  );
}
