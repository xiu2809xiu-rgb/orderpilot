import { useId } from "react";

interface FilterSelectProps {
  /** Names the filter for screen readers, and is the first option's words. */
  label: string;
  allLabel: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string | undefined) => void;
}

/** One filter in a list's bar. A link can set a value the options have not loaded yet. */
export function FilterSelect({
  label,
  allLabel,
  value,
  options,
  onChange,
}: FilterSelectProps) {
  const id = useId();
  const known = value === "" || options.some((o) => o.value === value);
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => {
          onChange(event.target.value || undefined);
        }}
        className="h-9 max-w-44 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">{allLabel}</option>
        {known ? null : <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </>
  );
}
