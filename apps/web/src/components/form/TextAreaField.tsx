import type { FieldValues } from "react-hook-form";
import { FormControl, FormField } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FieldFrame } from "./FieldFrame";
import { asText, type FieldBaseProps } from "./fieldTypes";

interface TextAreaFieldProps<T extends FieldValues, O> extends FieldBaseProps<
  T,
  O
> {
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}

/** Long text, such as remarks. Enter adds a line here; Ctrl+S still saves. */
export function TextAreaField<T extends FieldValues, O = T>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
  readOnly,
  className,
  rows = 3,
  placeholder,
  maxLength,
}: TextAreaFieldProps<T, O>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FieldFrame
          label={label}
          hint={hint}
          required={required}
          className={className}
        >
          <FormControl>
            <Textarea
              ref={field.ref}
              name={field.name}
              value={asText(field.value)}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              readOnly={readOnly}
              aria-required={required === true ? true : undefined}
              rows={rows}
              placeholder={placeholder}
              maxLength={maxLength}
              className="min-h-16 read-only:border-dashed read-only:bg-muted/40 read-only:shadow-none"
            />
          </FormControl>
        </FieldFrame>
      )}
    />
  );
}
