import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DotPattern } from "../kit/DotPattern";
import "./states.css";

const HEADINGS = { 1: "h1", 2: "h2", 3: "h3" } as const;

interface StatePanelProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  traceLabel?: string;
  traceId?: string;
  /** "page" fills a route (403, 404, crash). "inline" is the strip inside a list or a card. */
  variant?: "page" | "inline";
  /** The page variant is the page's h1. Inline panels are h2 unless told otherwise. */
  headingLevel?: 1 | 2 | 3;
  /** "danger" colours the icon, for a failure. Words say it too: colour never does alone. */
  tone?: "neutral" | "danger";
  /** Buttons: the next action, or retry. */
  children?: ReactNode;
  /** Sits beside the trace id, such as a copy button. */
  traceAction?: ReactNode;
}

/**
 * The base of every state: a page error, an empty list, a denied area. One
 * layout, so each state reads the same way wherever it appears. The inline
 * variant is the look the Orders workspace shows for an empty list: a dotted
 * field with the words in the middle and the next action under them. It does
 * not animate: a list in use never does.
 */
export function StatePanel({
  icon: Icon,
  title,
  description,
  traceLabel,
  traceId,
  variant = "page",
  headingLevel,
  tone = "neutral",
  children,
  traceAction,
}: StatePanelProps) {
  const Heading = HEADINGS[headingLevel ?? (variant === "page" ? 1 : 2)];
  return (
    <div className="st-panel" data-variant={variant}>
      {variant === "inline" ? (
        <DotPattern
          gap={14}
          fade={false}
          className="[mask-image:radial-gradient(ellipse_at_center,transparent_35%,#000_95%)]"
        />
      ) : null}
      <span className="st-chip" data-tone={tone}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <Heading className="st-title">{title}</Heading>
      {description ? <p className="st-text">{description}</p> : null}
      {traceId ? (
        <p className="st-trace">
          {traceLabel} <code>{traceId}</code>
          {traceAction}
        </p>
      ) : null}
      {children ? <div className="st-actions">{children}</div> : null}
    </div>
  );
}
