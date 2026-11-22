import type { LucideIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export interface Choice<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * A few choices in a row, drawn as pills: one is chosen, arrow keys move it
 * and Tab leaves the group. It is a radio group, so a screen reader says
 * "one of three".
 */
export function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  /** The group's accessible name. */
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly Choice<T>[];
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => {
        const chosen = options.find((option) => option.value === next);
        if (chosen) onChange(chosen.value);
      }}
      className="flex flex-wrap gap-s2"
    >
      {options.map(({ value: optionValue, label: optionLabel, icon: Icon }) => (
        <RadioGroupItem
          key={optionValue}
          value={optionValue}
          className="dx-choice"
        >
          {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
          {optionLabel}
        </RadioGroupItem>
      ))}
    </RadioGroup>
  );
}
