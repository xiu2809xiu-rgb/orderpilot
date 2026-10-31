import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Badges beside the title. */
  meta?: ReactNode;
  /** Buttons on the right. One primary action at most. */
  actions?: ReactNode;
}

/** The top of every page: title, a line of context, then actions. */
export function PageHeader({
  title,
  description,
  meta,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-s2">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {meta}
        </div>
        {description ? (
          <p className="measure text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
