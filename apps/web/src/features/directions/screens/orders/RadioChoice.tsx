import { useId } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
}

/**
 * A choice of a few, shown as radios because fewer than five options are all
 * in view at once. "Any" is the first and means no filter.
 */
export function RadioChoice<T extends string>({
  legend,
  anyLabel,
  value,
  options,
  onChange,
}: {
  legend: string;
  anyLabel: string;
  value: T | null;
  options: readonly Option<T>[];
  onChange: (value: T | null) => void;
}) {
  const name = useId();
  const all = [{ value: null, label: anyLabel }, ...options] as const;
  return (
    <fieldset className="space-y-1">
      <legend className="fs-14 font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-4">
        {all.map((option) => (
          <label
            key={option.value ?? "any"}
            className="fs-14 flex min-h-9 cursor-pointer items-center gap-2 pointer-coarse:min-h-11"
          >
            <input
              type="radio"
              name={name}
              className="size-4 accent-(--ring)"
              checked={value === option.value}
              onChange={() => {
                onChange(option.value);
              }}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
