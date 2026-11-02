import type { FieldValues } from "react-hook-form";
import { FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldFrame } from "./FieldFrame";
import { asText, FIELD_CONTROL, type FieldBaseProps } from "./fieldTypes";

interface DateFieldProps<T extends FieldValues, O> extends FieldBaseProps<
  T,
  O
> {
  /** The earliest date allowed, as YYYY-MM-DD. The schema still checks it. */
  min?: string;
  max?: string;
}

/**
 * A calendar date, held as YYYY-MM-DD with no time and no time zone, so a date
 * typed in Singapore is the same date on the server. The browser's own date
 * control gives keyboard entry and a picker without any extra code.
 */
export function DateField<T extends FieldValues, O = T>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
  readOnly,
  className,
  hideLabel,
  min,
  max,
}: DateFieldProps<T, O>) {
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
          <FormControl>
            <Input
              ref={field.ref}
              name={field.name}
              type="date"
              value={asText(field.value)}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              readOnly={readOnly}
              aria-required={required === true ? true : undefined}
              min={min}
              max={max}
              className={cn(FIELD_CONTROL, "tabular-nums")}
            />
          </FormControl>
        </FieldFrame>
      )}
    />
  );
}
