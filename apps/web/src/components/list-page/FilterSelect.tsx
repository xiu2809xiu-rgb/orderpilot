import { useId } from "react";
import { Field, NativeSelect } from "@/components/common/data-table/Field";
import { cn } from "@/lib/utils";

interface FilterSelectProps {
  /** Names the filter, and is always in view above it. */
  label: string;
  allLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
  /** The field fills its column, as in the More filters popover. */
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
    <Field label={label} htmlFor={id}>
      <NativeSelect
        id={id}
        value={value}
        className={cn("lp-select", showLabel && "lp-wide")}
        onChange={(event) => {
          onChange(event.target.value || undefined);
        }}
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
      </NativeSelect>
    </Field>
  );
}
