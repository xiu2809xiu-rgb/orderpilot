// Kit: React Bits / ThoughtLine. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { ShinyText } from "./ShinyText";
import "./kit.css";

interface ThoughtLineProps {
  /** What Spark is doing now, for example "Reading the document". */
  label: string;
  /** What the line says once it has settled. */
  doneLabel: string;
  /** What Spark did, in order. Shown when the line is opened. */
  steps?: readonly string[];
  working: boolean;
  /** A ready-made time, for example "3.1 s". The caller formats it. */
  timer?: string;
  /** The name of the button that opens and closes the steps. */
  toggleLabel: string;
  className?: string;
}

/**
 * A single line that shows what Spark is doing: a spark that breathes and a
 * label that shimmers while it works. When it settles the spark becomes a
 * check, the line says what was done and how long it took, and the steps fold
 * away behind a button that can open them again. The AI shows its work, one
 * line at a time. Under reduced motion nothing breathes or shimmers; the
 * wording alone says it is working.
 */
export function ThoughtLine({
  label,
  doneLabel,
  steps = [],
  working,
  timer,
  toggleLabel,
  className,
}: ThoughtLineProps) {
  const listId = useId();
  const [open, setOpen] = useState(working);
  useEffect(() => {
    setOpen(working);
  }, [working]);
  const canOpen = steps.length > 0;

  const line = (
    <>
      <span
        aria-hidden="true"
        className={cn("shrink-0 text-ring", working && "kit-breathe")}
      >
        {working ? (
          <Sparkles className="size-4" />
        ) : (
          <Check className="size-4" />
        )}
      </span>
      {working ? (
        <ShinyText className="fs-14">{label}</ShinyText>
      ) : (
        <span className="fs-14 text-foreground">{doneLabel}</span>
      )}
      {timer ? (
        <span className="numeral fs-14 text-muted-foreground">{timer}</span>
      ) : null}
    </>
  );

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {canOpen ? (
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          aria-label={toggleLabel}
          onClick={() => {
            setOpen((value) => !value);
          }}
          className="inline-flex min-h-8 items-center gap-2 self-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {line}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div role="status" className="inline-flex items-center gap-2">
          {line}
        </div>
      )}
      {canOpen ? (
        <ol
          id={listId}
          hidden={!open}
          className="fs-14 ml-6 flex flex-col gap-1 border-l border-border pl-3 text-muted-foreground"
        >
          {steps.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
