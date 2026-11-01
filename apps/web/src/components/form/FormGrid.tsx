import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const COLUMNS = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
} as const;

interface FormGridProps {
  columns?: keyof typeof COLUMNS;
  className?: string;
  children: ReactNode;
}

/**
 * The compact grid of an ERP header. Fields fill it row by row in source order,
 * so the Tab key walks the grid the way the eye does.
 */
export function FormGrid({ columns = 4, className, children }: FormGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-x-s2 gap-y-s2",
        COLUMNS[columns],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** What sits under the fields: the note on the required mark, then the buttons. */
export function FormActions({
  note,
  children,
}: {
  note: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-s2">
      <p className="text-xs text-muted-foreground">{note}</p>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {children}
      </div>
    </div>
  );
}
