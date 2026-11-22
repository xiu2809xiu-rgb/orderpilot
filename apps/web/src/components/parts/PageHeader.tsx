import type { ReactNode } from "react";
import { formatLongDay } from "@/lib/format";
import { opticalStyle } from "@/lib/opticalEdge";

/**
 * The head of every screen: its title, today's date as the line of context, and
 * a short intro. The title is gradient text.
 */
export function PageHeader({
  title,
  intro,
  actions,
}: {
  title: string;
  intro?: string;
  /** Buttons that belong to the whole screen, to the right of the title. */
  actions?: ReactNode;
}) {
  return (
    <header className="dx-page-head">
      <h1 className="dx-title optical-start" style={opticalStyle(title)}>
        {title}
      </h1>
      <p className="dx-title-context">{formatLongDay(new Date())}</p>
      {intro ? (
        <p className="dx-page-intro fs-14 max-w-prose">{intro}</p>
      ) : null}
      {actions ? <div className="dx-page-actions">{actions}</div> : null}
    </header>
  );
}
