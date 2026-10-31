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
  /** "page" fills a route (403, 404, crash). "inline" sits inside a card or table. */
  variant?: "page" | "inline";
  /** The page variant is the page's h1. Inline panels are h2 unless told otherwise. */
  headingLevel?: 1 | 2 | 3;
  /** Buttons: the next action, or retry. */
  children?: ReactNode;
  /** Extra content under the description, such as a trace id with a copy button. */
  footer?: ReactNode;
}

/**
 * The base of every state: a page error, an empty list, a denied area. One
 * layout, so each state reads the same way wherever it appears.
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
  footer,
}: StatePanelProps) {
  const Heading = HEADINGS[headingLevel ?? (variant === "page" ? 1 : 2)];
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-s2",
        variant === "page"
          ? "mx-auto max-w-md py-s6"
          : "rounded-xl border border-dashed p-s4",
      )}
    >
      <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <Heading
        className={cn(
          "font-semibold tracking-tight",
          variant === "page" ? "text-2xl" : "text-lg",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className="measure text-muted-foreground">{description}</p>
      ) : null}
      {traceId ? (
        <p className="text-xs text-muted-foreground">
          {traceLabel}{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground">
            {traceId}
          </code>
        </p>
      ) : null}
      {footer}
      {children ? <div className="flex gap-2 pt-2">{children}</div> : null}
    </div>
  );
}
