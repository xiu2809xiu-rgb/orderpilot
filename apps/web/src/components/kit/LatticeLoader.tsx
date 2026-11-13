// Kit: React Bits / LatticeLoader. Licence: MIT with the Commons Clause. Adapted to OrderPilot's tokens.
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import "./kit.css";

type LatticePattern = "orbit" | "snake" | "spiral";
type LatticeStatus = "working" | "done" | "error";

interface LatticeLoaderProps {
  /** The words beside the grid: what is being worked on, or the outcome. */
  label: string;
  status?: LatticeStatus;
  pattern?: LatticePattern;
  /** A ready-made time, for example "4.2 s". The caller formats it. */
  timer?: string;
  /** Side of one cell in pixels. */
  cell?: number;
  className?: string;
}

// The order in which each of the nine cells lights; null stays dark.
const ORDER: Record<LatticePattern, (number | null)[]> = {
  orbit: [0, 1, 2, 7, null, 3, 6, 5, 4],
  snake: [0, 1, 2, 5, 4, 3, 6, 7, 8],
  spiral: [0, 1, 2, 7, 8, 3, 6, 5, 4],
};
const DONE_CELLS = new Set([2, 3, 5, 7]);
const ERROR_CELLS = new Set([0, 2, 4, 6, 8]);
const STEP_MS = 110;

/**
 * A three by three grid that lights its cells in a path while Spark works,
 * then shows a check or a cross made of the same cells. The label is always
 * visible and announced (`role="status"`). Under reduced motion the grid stops
 * on a still frame. It is Spark's wait mark on the upload screen.
 */
export function LatticeLoader({
  label,
  status = "working",
  pattern = "orbit",
  timer,
  cell = 8,
  className,
}: LatticeLoaderProps) {
  const order = ORDER[pattern];
  const tone =
    status === "done"
      ? "bg-success"
      : status === "error"
        ? "bg-destructive"
        : "bg-ring";
  const lit = status === "done" ? DONE_CELLS : ERROR_CELLS;
  return (
    <span
      role="status"
      className={cn("inline-flex items-center gap-3 align-middle", className)}
    >
      <span
        aria-hidden="true"
        className="grid grid-cols-3"
        style={{ gap: Math.max(2, cell / 4) }}
      >
        {order.map((step, index) => {
          const on = status === "working" ? step !== null : lit.has(index);
          return (
            <span
              key={index}
              className={cn(
                tone,
                "block rounded-[2px]",
                status === "working" && step !== null && "kit-lattice-cell",
                !on && "opacity-15",
              )}
              style={
                {
                  width: cell,
                  height: cell,
                  "--kit-lattice-delay": `${String((step ?? 0) * STEP_MS)}ms`,
                  "--kit-lattice-cycle": `${String(8 * STEP_MS)}ms`,
                  opacity:
                    status === "working" && step !== null ? 0.55 : undefined,
                } as CSSProperties
              }
            />
          );
        })}
      </span>
      <span className="fs-14 text-foreground">{label}</span>
      {timer ? (
        <span className="numeral fs-14 text-muted-foreground">{timer}</span>
      ) : null}
    </span>
  );
}
