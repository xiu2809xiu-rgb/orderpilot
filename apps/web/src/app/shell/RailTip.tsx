import { Suspense, lazy, type ReactElement, type ReactNode } from "react";

// The tooltip code is wanted only once the panel is a rail, so it is a chunk of
// its own and the entry bundle does not carry it.
const RailTipBody = lazy(() => import("./RailTipBody"));

/**
 * In the 64 px rail a row shows only its icon, so its name moves into a
 * tooltip. With the panel open the row is given back as it is. Until the
 * tooltip's code arrives the row is shown without one.
 */
export function RailTip({
  show,
  tip,
  children,
}: {
  show: boolean;
  tip: ReactNode;
  children: ReactElement;
}) {
  if (!show) return children;
  return (
    <Suspense fallback={children}>
      <RailTipBody tip={tip}>{children}</RailTipBody>
    </Suspense>
  );
}
