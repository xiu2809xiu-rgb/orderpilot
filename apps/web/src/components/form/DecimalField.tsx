import { useId } from "react";
import type { FieldValues } from "react-hook-form";
import { FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { normaliseDecimal } from "./decimal";
import { FieldFrame } from "./FieldFrame";
import { asText, FIELD_CONTROL, type FieldBaseProps } from "./fieldTypes";

export interface DecimalFieldProps<
  T extends FieldValues,
  O,
> extends FieldBaseProps<T, O> {
  /** Digits after the point. Zero means whole numbers. */
  scale?: number;
  placeholder?: string;
}

interface AffixProps {
  /** Before the amount, such as a currency code. */
  prefix?: string;
  /** After the amount, such as a unit. */
  suffix?: string;
}

const AFFIX =
  "inline-flex h-8 shrink-0 items-center border border-input bg-muted/50 px-2 text-xs text-muted-foreground";

/**
 * The value stays a decimal string: an amount never passes through a float.
 * Right-aligned in tabular figures, so a column of them lines up. A prefix or a
 * suffix is part of the field's accessible description.
 */
export function DecimalField<T extends FieldValues, O = T>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
  readOnly,
  className,
  scale = 0,
  placeholder,
  prefix,
  suffix,
}: DecimalFieldProps<T, O> & AffixProps) {
  const affixId = useId();
  const affix = prefix ?? suffix;
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
          <div className="flex">
            {prefix === undefined ? null : (
              <span
                id={affixId}
                className={cn(AFFIX, "rounded-l-md border-r-0")}
              >
                {prefix}
              </span>
            )}
            <FormControl
              describedBy={affix === undefined ? undefined : affixId}
            >
              <Input
                ref={field.ref}
                name={field.name}
                type="text"
                inputMode={scale > 0 ? "decimal" : "numeric"}
                value={asText(field.value)}
                onChange={field.onChange}
                onBlur={(event) => {
                  const tidy = normaliseDecimal(event.target.value, scale);
                  if (tidy !== event.target.value) field.onChange(tidy);
                  field.onBlur();
                }}
                disabled={disabled}
                readOnly={readOnly}
                aria-required={required === true ? true : undefined}
                placeholder={placeholder}
                autoComplete="off"
                className={cn(
                  FIELD_CONTROL,
                  "text-right tabular-nums",
                  prefix !== undefined && "rounded-l-none",
                  suffix !== undefined && "rounded-r-none",
                )}
              />
            </FormControl>
            {suffix === undefined || prefix !== undefined ? null : (
              <span
                id={affixId}
                className={cn(AFFIX, "rounded-r-md border-l-0")}
              >
                {suffix}
              </span>
            )}
          </div>
        </FieldFrame>
      )}
    />
  );
}
