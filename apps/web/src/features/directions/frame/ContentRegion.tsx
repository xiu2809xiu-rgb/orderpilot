import { Suspense, ViewTransition } from "react";
import { useTranslation } from "react-i18next";
import type { Direction } from "../directions";
import type { ScreenDef } from "../screens";
import { ContentSkeleton } from "./ContentSkeleton";

/**
 * Where a screen is drawn. Only this region animates when the screen changes:
 * the direction's named view transition, with the shell and the bar standing
 * still. React skips the animation where the browser has no view transitions.
 * While a screen's chunk loads, a skeleton in the final layout holds its place
 * and a thin line appears if the wait passes 400 ms.
 */
export function ContentRegion({
  direction,
  screen,
}: {
  direction: Direction;
  screen: ScreenDef;
}) {
  const { t } = useTranslation("directions");
  const Skeleton = screen.Skeleton ?? ContentSkeleton;
  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative min-h-0 flex-1 outline-none"
    >
      {direction === "ink" ? (
        <span
          key={`sweep-${screen.id}`}
          aria-hidden="true"
          className="dx-sweep pointer-events-none absolute inset-x-0 top-0 z-10 h-px"
        />
      ) : null}
      <div className="dx-content h-full overflow-x-clip overflow-y-auto">
        <ViewTransition key={screen.id} default={`dx-${direction}-page`}>
          <div>
            <Suspense
              fallback={
                <div role="status" aria-label={t("content.loading")}>
                  <span className="dx-progress" aria-hidden="true">
                    <i />
                  </span>
                  <Skeleton />
                </div>
              }
            >
              <screen.Component />
            </Suspense>
          </div>
        </ViewTransition>
      </div>
    </main>
  );
}
