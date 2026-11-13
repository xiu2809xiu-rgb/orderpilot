import { Link } from "react-router";
import { cn } from "@/lib/utils";
import {
  Stepper,
  StepperDescription,
  StepperItem,
  StepperTitle,
  type StepperLabels,
} from "../../kit/Stepper";

export interface FlowCell {
  id: string;
  title: string;
  /** Orders at this step; null when the tracker has no count for it. */
  count: number | null;
  /** Where the cell leads, or null when it is only a label. */
  href: string | null;
  /** The sentence a screen reader gets for a link. */
  linkLabel?: string;
  /** The step with the most orders. */
  busiest: boolean;
  /** Says what the number counts, under the title. */
  note: string;
}

/**
 * One flow as a row of cells: the step's name, the orders at it as a large
 * figure and a bar sized against the busiest step. The row is ReUI's stepper
 * as a list; the cell with the most orders is its current step, so it carries
 * the accent and a screen reader hears which it is. It scrolls inside its box
 * on a narrow screen rather than squeezing nine columns.
 */
export function FlowRow({
  label,
  labels,
  cells,
}: {
  label: string;
  labels: StepperLabels;
  cells: readonly FlowCell[];
}) {
  const most = Math.max(1, ...cells.map((cell) => cell.count ?? 0));
  const busiest = cells.findIndex((cell) => cell.busiest);
  return (
    <div className="overflow-x-auto" data-flow-scroll>
      <Stepper
        label={label}
        labels={labels}
        value={busiest + 1}
        className="min-w-[52rem] gap-2"
      >
        {cells.map((cell, index) => {
          const body = (
            <>
              {cell.count !== null ? (
                <span className="numeral fs-28 block text-foreground">
                  {cell.count}
                </span>
              ) : null}
              <StepperTitle className="fs-13 leading-tight">
                {cell.title}
              </StepperTitle>
              <StepperDescription
                className={cn("fs-12", cell.count !== null && "sr-only")}
              >
                {cell.note}
              </StepperDescription>
              {cell.count !== null ? (
                <span
                  aria-hidden="true"
                  className="mt-2 block h-1 w-full bg-(--border)"
                  style={{ borderRadius: "var(--radius-pill)" }}
                >
                  <span
                    className="block h-full bg-ring"
                    style={{
                      width: `${String(Math.max(4, (cell.count / most) * 100))}%`,
                      borderRadius: "var(--radius-pill)",
                    }}
                  />
                </span>
              ) : null}
            </>
          );
          const frame = cn(
            "flex h-full flex-col gap-0.5 border p-3 text-left",
            cell.busiest ? "border-ring" : "border-border",
          );
          return (
            <StepperItem key={cell.id} step={index + 1} className="min-w-0">
              {cell.href ? (
                <Link
                  to={cell.href}
                  aria-label={cell.linkLabel}
                  className={cn(
                    frame,
                    "transition-colors hover:bg-(--dx-hover-bg) focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:min-h-11",
                  )}
                  style={{ borderRadius: "var(--radius-control)" }}
                >
                  {body}
                </Link>
              ) : (
                <div
                  className={frame}
                  style={{ borderRadius: "var(--radius-control)" }}
                >
                  {body}
                </div>
              )}
            </StepperItem>
          );
        })}
      </Stepper>
    </div>
  );
}
