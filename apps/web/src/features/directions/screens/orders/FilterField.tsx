import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A filter with its label always in view, above the control. A placeholder is
 * never the label: it disappears while a person types.
 */
export function FilterField({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  /** The id of the control, so the label names it. */
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("od-field", className)}>
      <label htmlFor={htmlFor} className="od-field-label fs-12">
        {label}
      </label>
      {children}
    </div>
  );
}
