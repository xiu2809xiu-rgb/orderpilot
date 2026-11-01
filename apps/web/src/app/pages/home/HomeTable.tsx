import { CircleCheck, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { ScrollRegion, StatePanel } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";

export interface HomeColumn {
  id: string;
  label: string;
  /** Numbers and money sit on the right. */
  end?: boolean;
  /** Long text wraps instead of widening the table. */
  wrap?: boolean;
  /** The row's one action. It stays in view when a wide table scrolls. */
  action?: boolean;
}

export interface HomeRow {
  id: string;
  /** The content of each column, by column id. */
  cells: Readonly<Record<string, ReactNode>>;
}

// Tailwind's md breakpoint, where the table gives way to stacked rows.
const NARROW = "(max-width: 47.99rem)";

const PINNED = "sticky z-[1] bg-card";

function cellClass(column: HomeColumn, first: boolean): string {
  return cn(
    "px-2 py-0.5 align-middle",
    first || column.wrap ? "whitespace-normal" : "whitespace-nowrap",
    first && `left-0 ${PINNED}`,
    column.wrap && "min-w-32",
    column.end && "text-right tabular-nums",
    column.action && `right-0 text-right ${PINNED}`,
  );
}

/** A compact table: 36 to 40 px rows, with the first and last columns held in view. */
function RowTable({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: readonly HomeColumn[];
  rows: readonly HomeRow[];
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
                  index === 0 && `left-0 ${PINNED}`,
                  column.end && "text-right",
                  column.action && `right-0 text-right ${PINNED}`,
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
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column, index) => (
                <td key={column.id} className={cellClass(column, index === 0)}>
                  {row.cells[column.id]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollRegion>
  );
}

function pairs<T>(items: readonly T[]): T[][] {
  const lines: T[][] = [];
  for (let start = 0; start < items.length; start += 2) {
    lines.push(items.slice(start, start + 2));
  }
  return lines;
}

/** The same rows on a phone: each one stacked, so nothing is cut off or scrolls sideways. */
function RowStack({
  label,
  columns,
  rows,
}: {
  label: string;
  columns: readonly HomeColumn[];
  rows: readonly HomeRow[];
}) {
  const [first, ...rest] = columns;
  const details = rest.filter((column) => !column.action);
  const action = rest.find((column) => column.action);
  return (
    <ul aria-label={label} className="divide-y text-sm">
      {rows.map((row) => (
        <li key={row.id} className="space-y-1 py-2 first:pt-0 last:pb-0">
          {first ? (
            <div className="font-medium">{row.cells[first.id]}</div>
          ) : null}
          {pairs(details).map((line) => (
            <div
              key={line[0]?.id}
              className="flex flex-wrap justify-between gap-x-3 text-muted-foreground"
            >
              {line.map((column) => (
                <div key={column.id} className="min-w-0">
                  <span className="sr-only">{column.label}: </span>
                  {row.cells[column.id]}
                </div>
              ))}
            </div>
          ))}
          {action ? (
            <div className="flex justify-end">{row.cells[action.id]}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** A role's short list inside a card: a table, or stacked rows on a phone. */
export function HomeTable(props: {
  label: string;
  columns: readonly HomeColumn[];
  rows: readonly HomeRow[];
}) {
  const narrow = useMediaQuery(NARROW);
  return narrow ? <RowStack {...props} /> : <RowTable {...props} />;
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
