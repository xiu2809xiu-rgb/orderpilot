import type { FieldValues } from "react-hook-form";
import { FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldFrame } from "./FieldFrame";
import { asText, FIELD_CONTROL, type FieldBaseProps } from "./fieldTypes";

interface TextFieldProps<T extends FieldValues, O> extends FieldBaseProps<
  T,
  O
> {
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
  /** For codes and references, such as a PO number: monospace, no spellcheck. */
  code?: boolean;
}

/** A single line of text. Enter in it never submits the form. */
export function TextField<T extends FieldValues, O = T>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
  readOnly,
  className,
  type = "text",
  placeholder,
  autoComplete = "off",
  maxLength,
  code = false,
}: TextFieldProps<T, O>) {
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
            <Input
              ref={field.ref}
              name={field.name}
              type={type}
              value={asText(field.value)}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={disabled}
              readOnly={readOnly}
              aria-required={required === true ? true : undefined}
              placeholder={placeholder}
              autoComplete={autoComplete}
              maxLength={maxLength}
              spellCheck={code ? false : undefined}
              className={cn(FIELD_CONTROL, code && "font-mono")}
            />
          </FormControl>
        </FieldFrame>
      )}
    />
  );
}
