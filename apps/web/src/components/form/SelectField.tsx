import type { FieldValues } from "react-hook-form";
import { FormField } from "@/components/ui/form";
import { FieldFrame } from "./FieldFrame";
import type { FieldBaseProps } from "./fieldTypes";
import { SelectControl, type SelectOption } from "./SelectControl";

export type { SelectOption };

interface SelectFieldProps<T extends FieldValues, O> extends FieldBaseProps<
  T,
  O
> {
  options: readonly SelectOption[];
  placeholder?: string;
}

/** One choice from a short, fixed list. A long or searched list is a lookup. */
export function SelectField<T extends FieldValues, O = T>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
  readOnly,
  className,
  hideLabel,
  options,
  placeholder,
}: SelectFieldProps<T, O>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FieldFrame
          label={label}
          hint={hint}
          required={required}
          hideLabel={hideLabel}
          className={className}
        >
          <SelectControl
            field={field}
            options={options}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
          />
        </FieldFrame>
      )}
    />
  );
}
