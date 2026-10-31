import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const HEADINGS = { 1: "h1", 2: "h2", 3: "h3" } as const;

interface StatePanelProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  traceLabel?: string;
  traceId?: string;
  /** "page" fills a route (403, 404, crash). "inline" is a compact strip inside a card or table. */
  variant?: "page" | "inline";
  /** The page variant is the page's h1. Inline panels are h2 unless told otherwise. */
  headingLevel?: 1 | 2 | 3;
  /** Buttons: the next action, or retry. */
  children?: ReactNode;
  /** Sits beside the trace id, such as a copy button. */
  traceAction?: ReactNode;
}

/**
 * The base of every state: a page error, an empty list, a denied area. One
 * layout, so each state reads the same way wherever it appears. The inline
 * variant is a compact strip, icon and words on the left and the next action
 * on the right, never a large empty card.
 */
export function StatePanel({
  icon: Icon,
  title,
  description,
  traceLabel,
  traceId,
  variant = "page",
  headingLevel,
  children,
  traceAction,
}: StatePanelProps) {
  const Heading = HEADINGS[headingLevel ?? (variant === "page" ? 1 : 2)];
  const inline = variant === "inline";
  return (
    <div
      className={cn(
        inline
          ? "flex flex-wrap items-center gap-x-s2 gap-y-s1 rounded-lg border border-dashed px-s2 py-s2"
          : "mx-auto flex max-w-md flex-col items-start gap-s2 py-s6",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground",
          inline ? "size-8" : "size-10",
        )}
      >
        <Icon className={inline ? "size-4" : "size-5"} aria-hidden="true" />
      </span>
      <div className={cn("space-y-1", inline && "min-w-48 flex-1")}>
        <Heading
          className={cn(
            "font-semibold tracking-tight",
            inline ? "text-base" : "text-2xl",
          )}
        >
          {title}
        </Heading>
        {description ? (
          <p className="measure text-muted-foreground">{description}</p>
        ) : null}
        {traceId ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {traceLabel}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
              {traceId}
            </code>
            {traceAction}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className={cn("flex gap-2", !inline && "pt-2")}>{children}</div>
      ) : null}
    </div>
  );
}
