import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The ids a control uses to be named and described by its row. */
export interface RowIds {
  labelId: string;
  descriptionId: string;
}

/**
 * A card's rows: each is one thing that can be read or changed, with a line
 * between. `tight` sets 16 px above and below each row instead of 24, but the
 * first row keeps no space above and the last none below, so it shows only
 * between two rows (32 px apart instead of 48) and never in a list of one. It
 * is a prop of the list, not of SettingRow, because other screens use the
 * default row.
 */
export function SettingList({
  children,
  className,
  tight = false,
}: {
  children: ReactNode;
  className?: string;
  tight?: boolean;
}) {
  return (
    <ul
      className={cn(
        "divide-y divide-border",
        tight && "[&>li]:py-s2",
        className,
      )}
    >
      {children}
    </ul>
  );
}

/**
 * One row of a settings card, as in the settings of Stripe or Linear: what it
 * is, one plain line about it, and on the right the control or the value.
 * Under a phone's `sm` width the control moves under the words. A function as
 * `control` receives the ids of the label and the description, so a switch or
 * a button can be named and described by them.
 */
export function SettingRow({
  label,
  description,
  control,
  value,
  align = "center",
  children,
}: {
  label: ReactNode;
  description?: string;
  control?: ReactNode | ((ids: RowIds) => ReactNode);
  /** A read-only answer, drawn where a control would be. */
  value?: string;
  align?: "center" | "start";
  /** A note under the row, such as an alert or the result of the control. */
  children?: ReactNode;
}) {
  const labelId = useId();
  const descriptionId = useId();
  const drawn =
    typeof control === "function"
      ? control({ labelId, descriptionId })
      : control;
  return (
    <li
      className={cn(
        "grid gap-x-s4 gap-y-s2 py-s3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]",
        align === "center" ? "sm:items-center" : "sm:items-start",
      )}
    >
      <div className="min-w-0">
        <p id={labelId} className="fs-14 font-medium">
          {label}
        </p>
        {description ? (
          <p
            id={descriptionId}
            className="fs-14 max-w-prose text-muted-foreground"
          >
            {description}
          </p>
        ) : null}
      </div>
      {value ? (
        <p className="fs-14 min-w-0 break-words sm:text-right">{value}</p>
      ) : drawn ? (
        <div className="min-w-0 sm:justify-self-end">{drawn}</div>
      ) : null}
      {children ? (
        <div className="min-w-0 sm:col-span-2">{children}</div>
      ) : null}
    </li>
  );
}

/** The quiet line under a card: where a choice is kept, or who can change it. */
export function SettingFootnote({ children }: { children: ReactNode }) {
  return (
    <p className="fs-12 mt-s3 max-w-prose text-muted-foreground">{children}</p>
  );
}
