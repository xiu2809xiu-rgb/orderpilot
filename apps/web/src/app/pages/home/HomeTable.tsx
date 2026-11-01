import { CircleCheck, type LucideIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ScrollRegion, StatePanel } from "@/components/common";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HomeColumn {
  id: string;
  label: string;
  /** Numbers and money sit on the right. */
  end?: boolean;
  /** Long text wraps instead of widening the table. */
  wrap?: boolean;
  /** Never wraps, not even the first column. A row stays one line high, or the table gives way to stacked rows. */
  single?: boolean;
  /** The row's one action. It stays in view when a wide table scrolls. */
  action?: boolean;
}

export interface HomeRow {
  id: string;
  /** The content of each column, by column id. */
  cells: Readonly<Record<string, ReactNode>>;
}

const PINNED = "sticky z-[1] bg-card";

function cellClass(column: HomeColumn, first: boolean): string {
  return cn(
    // A cell's height is its least height, so a row with no button keeps 36 px too.
    "h-9 px-1.5 py-0.5 align-middle",
    (first || column.wrap) && !column.single
      ? "whitespace-normal"
      : "whitespace-nowrap",
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
                  "h-8 px-1.5 font-medium whitespace-nowrap",
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

/**
 * True while the card is too narrow for the whole table. The card is measured,
 * not the screen: a sidebar, a laptop or a tablet on its side all change how much
 * room a table has. The table's own width is kept while it is shown, so the
 * stacked rows know how much room to wait for. A table that is cut off would hide the
 * amount a person is about to confirm.
 */
function useStacked() {
  const box = useRef<HTMLDivElement>(null);
  const needed = useRef(0);
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      const table = element.querySelector("table");
      if (table) {
        // The table stretches to its card, so its own width says nothing until
        // it is let size itself.
        table.style.width = "auto";
        needed.current = table.offsetWidth;
        table.style.width = "";
      }
      setStacked(element.clientWidth + 1 < needed.current);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const table = element.querySelector("table");
    if (table) observer.observe(table);
    return () => {
      observer.disconnect();
    };
  }, [stacked]);
  return { box, stacked };
}

/** A role's short list inside a card: a table where it fits, stacked rows where it does not. */
export function HomeTable(props: {
  label: string;
  columns: readonly HomeColumn[];
  rows: readonly HomeRow[];
}) {
  const { box, stacked } = useStacked();
  return (
    <div ref={box}>
      {stacked ? <RowStack {...props} /> : <RowTable {...props} />}
    </div>
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
