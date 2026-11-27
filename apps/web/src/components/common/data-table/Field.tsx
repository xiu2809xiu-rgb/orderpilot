import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChipCheck } from "../ChipCheck";
import "./data-table.css";

/**
 * A control with its label always in view, above it. A placeholder is never
 * the label: it goes while a person types.
 */
export function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  /** The id of the control, so the label names it. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("dt-field", className)}>
      <label htmlFor={htmlFor} className="dt-field-label">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * A yes or no filter as a chip that stays pressed. It is a switch for a
 * screen reader, and a tick shows it is on, so colour never says it alone.
 * The tick has a slot of its own that eases open (see chip.css).
 */
export function ToggleChip({
  checked,
  onCheckedChange,
  children,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      className="dt-toggle"
      onClick={() => {
        onCheckedChange(!checked);
      }}
    >
      <ChipCheck on={checked} />
      {children}
    </button>
  );
}

/**
 * The browser's own select, drawn as the app's field: it keeps the keyboard,
 * the touch picker and the label a screen reader reads, and a chevron says
 * what it is.
 */
export function NativeSelect({
  className,
  compact = false,
  children,
  ...props
}: ComponentProps<"select"> & { compact?: boolean }) {
  return (
    <span
      className={cn("dt-select", className)}
      data-size={compact ? "page" : undefined}
    >
      <select {...props}>{children}</select>
      <ChevronDown aria-hidden="true" className="dt-select-mark" />
    </span>
  );
}
