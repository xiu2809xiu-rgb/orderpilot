import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ErrorStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  traceLabel?: string;
  traceId?: string;
  children?: ReactNode;
}

/** The shared look of 403, 404 and the crash page. */
export function ErrorState({
  icon: Icon,
  title,
  description,
  traceLabel,
  traceId,
  children,
}: ErrorStateProps) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-start gap-s2 py-s6">
      <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
      {traceId ? (
        <p className="text-xs text-muted-foreground">
          {traceLabel}{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {traceId}
          </code>
        </p>
      ) : null}
      {children ? <div className="flex gap-2 pt-2">{children}</div> : null}
    </div>
  );
}
