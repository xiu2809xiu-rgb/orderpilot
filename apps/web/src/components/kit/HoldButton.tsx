// Kit: React Bits / HoldButton. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { Check } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HoldButtonProps {
  children: ReactNode;
  /** What the button says once the hold has completed. */
  doneLabel: ReactNode;
  /** Called once, when the hold completes. */
  onHold: () => void;
  /** Milliseconds the press must last. */
  holdTime?: number;
  disabled?: boolean;
  /** Id of the text that explains the hold, for assistive technology. */
  describedBy?: string;
  className?: string;
}

type Phase = "idle" | "holding" | "done";

/**
 * A button that must be held to count: a fill grows under the label while the
 * pointer or Space or Enter stays down, and the action runs only when it is
 * full. Letting go early cancels. It is the pattern for a deliberate approval
 * (a payment hold clearing, a bank-detail change), where a stray click must do
 * nothing. The fill is a CSS transition, so reduced motion makes it jump at
 * the end; the hold itself still applies, because it is a safeguard and not
 * decoration. The caller explains the hold in text next to it.
 */
export function HoldButton({
  children,
  doneLabel,
  onHold,
  holdTime = 900,
  disabled = false,
  describedBy,
  className,
}: HoldButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setPhase((value) => (value === "holding" ? "idle" : value));
  };
  const start = () => {
    if (disabled || phase !== "idle") return;
    setPhase("holding");
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setPhase("done");
      onHold();
    }, holdTime);
  };
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const holding = phase === "holding";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-describedby={describedBy}
      data-phase={phase}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onKeyDown={(event) => {
        if ((event.key === " " || event.key === "Enter") && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === " " || event.key === "Enter") cancel();
      }}
      onBlur={cancel}
      className={cn(
        "fs-14 relative isolate inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden bg-primary px-4 font-medium text-primary-foreground outline-none select-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        className,
      )}
      style={{ borderRadius: "var(--radius-control)", touchAction: "none" }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10 origin-left bg-black/25 motion-safe:ease-linear"
        style={{
          transform: holding || phase === "done" ? "scaleX(1)" : "scaleX(0)",
          transition: holding
            ? `transform ${String(holdTime)}ms linear`
            : "transform 180ms ease-out",
        }}
      />
      {phase === "done" ? (
        <Check aria-hidden="true" className="size-4" />
      ) : null}
      <span>{phase === "done" ? doneLabel : children}</span>
    </button>
  );
}
