// Kit: React Bits / StatusMark. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import { cn } from "@/lib/utils";
import "./kit.css";

export type StatusMarkState =
  "pending" | "running" | "done" | "failed" | "cancelled";

interface StatusMarkProps {
  status: StatusMarkState;
  /** The words next to the mark. A status is never a symbol alone. */
  label: string;
  /** Side of the mark in pixels. */
  size?: number;
  className?: string;
}

const TONE: Record<StatusMarkState, string> = {
  pending: "text-muted-foreground",
  running: "text-ring",
  done: "text-success",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

const RADIUS = 9;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * One mark for the state of a piece of work: a dashed ring (waiting), an arc
 * that turns (working), a check, a cross, or a bar (cancelled). The label is
 * required and always shown, so colour never carries the meaning alone. The
 * arc turns only when motion is allowed; otherwise it is a still three-quarter
 * ring. React Bits morphs between states with a spring; here a state change
 * is a clean swap, which is what a table of statuses needs.
 */
export function StatusMark({
  status,
  label,
  size = 18,
  className,
}: StatusMarkProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 align-middle",
        TONE[status],
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="shrink-0"
      >
        {status === "pending" ? (
          <circle cx="12" cy="12" r={RADIUS} strokeDasharray="3 3.6" />
        ) : null}
        {status === "running" ? (
          <>
            <circle cx="12" cy="12" r={RADIUS} opacity="0.2" />
            <circle
              className="kit-spin"
              cx="12"
              cy="12"
              r={RADIUS}
              strokeDasharray={`${String(CIRCUMFERENCE * 0.68)} ${String(CIRCUMFERENCE)}`}
            />
          </>
        ) : null}
        {status === "done" ? (
          <>
            <circle cx="12" cy="12" r={RADIUS} />
            <path d="M7.5 12.25 10.5 15.25 16.75 8.75" />
          </>
        ) : null}
        {status === "failed" ? (
          <>
            <circle cx="12" cy="12" r={RADIUS} />
            <path d="M8.5 8.5 15.5 15.5M15.5 8.5 8.5 15.5" />
          </>
        ) : null}
        {status === "cancelled" ? (
          <>
            <circle cx="12" cy="12" r={RADIUS} opacity="0.5" />
            <path d="M8.5 12h7" />
          </>
        ) : null}
      </svg>
      <span className="text-foreground">{label}</span>
    </span>
  );
}
