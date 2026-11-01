import { CircleCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ScrollRegion, StatePanel } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HomeColumn {
  id: string;
  label: string;
  /** Numbers and money sit on the right. */
  end?: boolean;
  /** The last column keeps its button in view on a narrow screen. */
  action?: boolean;
}

const PINNED_FIRST =
  "sticky left-0 z-[1] bg-card max-md:max-w-36 max-md:border-r";
const PINNED_LAST = "sticky right-0 z-[1] bg-card max-md:border-l";

/** A cell of a home table: first keeps the row's name in view when the table scrolls. */
export function homeCell(column: Pick<HomeColumn, "end" | "action">): string {
  return cn(
    "whitespace-nowrap px-2 py-1.5 align-middle",
    column.end && "text-right tabular-nums",
    column.action && `text-right ${PINNED_LAST}`,
  );
}

/** The first cell: it may wrap, so a long task is never cut off. */
export const HOME_FIRST_CELL = `whitespace-normal px-2 py-1.5 align-middle ${PINNED_FIRST}`;

/** A compact table inside a card. It scrolls in its own box on a phone. */
export function HomeTable({
  label,
  columns,
  children,
}: {
  label: string;
  columns: readonly HomeColumn[];
  children: ReactNode;
}) {
  return (
    <ScrollRegion
      label={label}
      className="rounded-none border-0 bg-transparent"
    >
      <table className="w-full text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {columns.map((column, index) => (
              <th
                key={column.id}
                scope="col"
                className={cn(
                  "h-8 px-2 font-medium whitespace-nowrap",
                  index === 0 && "sticky left-0 z-[1] bg-card max-md:border-r",
                  column.end && "text-right",
                  column.action && `text-right ${PINNED_LAST}`,
                )}
              >
                {column.action ? (
                  <span className="sr-only">{column.label}</span>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </ScrollRegion>
  );
}

/** "View all (24)", on the right of the card's title. */
export function ViewAll({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex min-h-6 items-center text-sm font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline"
    >
      {label}
    </Link>
  );
}

/** Nothing to show: says so in a compact strip and names the next step. */
export function HomeEmpty({
  title,
  description,
  to,
  action,
  icon = CircleCheck,
}: {
  title: string;
  description: string;
  to: string;
  action: string;
  icon?: LucideIcon;
}) {
  return (
    <StatePanel
      variant="inline"
      icon={icon}
      title={title}
      description={description}
      headingLevel={3}
    >
      <Link to={to} className={buttonVariants({ variant: "outline" })}>
        {action}
      </Link>
    </StatePanel>
  );
}
