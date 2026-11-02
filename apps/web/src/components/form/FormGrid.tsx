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
