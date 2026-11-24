import type { ReactNode } from "react";
import { BlurFade } from "@/components/kit/BlurFade";
import { formatLongDay } from "@/lib/format";
import { opticalStyle } from "@/lib/opticalEdge";

/**
 * The head of Home: the same markup as the shared PageHeader, so it looks and
 * reads the same, with its first view added. The greeting and the date arrive
 * with a short blur and rise, then the line under them (when its numbers are
 * known). Its figures are the true ones from the first frame: a count that
 * runs while a person reads the line shows them wrong numbers. The buttons are
 * not wrapped: they are there and usable from the first frame.
 */
export function HomeHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="dx-page-head">
      <BlurFade offset={8} blur={4}>
        <h1 className="dx-title optical-start" style={opticalStyle(title)}>
          {title}
        </h1>
        <p className="dx-title-context">{formatLongDay(new Date())}</p>
      </BlurFade>
      {intro ? (
        <BlurFade offset={6} blur={3} delay={0.03}>
          <p className="dx-page-intro fs-14 max-w-prose">{intro}</p>
        </BlurFade>
      ) : null}
      {actions ? <div className="dx-page-actions">{actions}</div> : null}
    </header>
  );
}
