import type { Control, FieldPath, FieldValues } from "react-hook-form";

/** What every field takes. Text comes from the page's own namespace. */
export interface FieldBaseProps<T extends FieldValues, O = T> {
  control: Control<T, unknown, O>;
  name: FieldPath<T>;
  label: string;
  /** A short line under the field, read out with it. */
  hint?: string;
  required?: boolean;
  /** Cannot be changed, and says nothing about why: prefer `readOnly`. */
  disabled?: boolean;
  /** Shown, focusable and copyable, but not editable. */
  readOnly?: boolean;
  /**
   * For a cell of a grid whose column header shows the label: it stays the
   * field's accessible name, but is not drawn.
   */
  hideLabel?: boolean;
  /** Placement in the grid, such as "sm:col-span-2". */
  className?: string;
}

/**
 * The compact control of an ERP header, and how a read-only one looks. On a
 * touch screen it grows to 44 px, the size warehouse tablets need.
 */
export const FIELD_CONTROL =
  "h-8 pointer-coarse:h-11 read-only:border-dashed read-only:bg-muted/40 read-only:shadow-none";

/** A field's value as text, whatever the form holds there. */
export function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}
