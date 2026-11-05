import { useId } from "react";
import { cn } from "@/lib/utils";

interface FilterSelectProps {
  /** Names the filter. Hidden from sight unless `showLabel`, but always read aloud. */
  label: string;
  allLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  /** Draw the label above the field, as in the More filters popover. */
  showLabel?: boolean;
  /** Says a value the options do not list, such as several statuses from a link. */
  describe?: ((value: string) => string) | undefined;
}

/** One filter in a list's bar. A link can set a value the options have not loaded yet. */
export function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
  showLabel = false,
  describe,
}: FilterSelectProps) {
  const id = useId();
  const known = value === "" || options.some((o) => o.value === value);
  return (
    <div className={showLabel ? "space-y-1" : undefined}>
      <label
        htmlFor={id}
        className={showLabel ? "text-xs text-muted-foreground" : "sr-only"}
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value || undefined);
        }}
        className={cn(
          "h-9 rounded-md border border-input bg-background px-2 text-sm pointer-coarse:h-11",
          showLabel ? "w-full" : "max-w-44",
        )}
      >
        <option value="">{allLabel}</option>
        {known ? null : (
          <option value={value}>{describe?.(value) ?? value}</option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
