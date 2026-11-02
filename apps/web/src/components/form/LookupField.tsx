import type { FieldValues } from "react-hook-form";
import { FormControl, FormField } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FieldFrame } from "./FieldFrame";
import { FIELD_CONTROL, type FieldBaseProps } from "./fieldTypes";
import {
  lookupText,
  lookupValueSchema,
  type LookupOption,
  type LookupSearch,
} from "./lookup";
import { LookupControl } from "./LookupControl";

interface LookupFieldProps<T extends FieldValues, O> extends FieldBaseProps<
  T,
  O
> {
  /** Finds records for the typed text. The lookup knows nothing else about them. */
  search: LookupSearch;
  placeholder?: string;
  debounceMs?: number;
  /**
   * Called with the whole record that was picked, so that a page can fill what
   * depends on it, such as a unit price or the stock on hand.
   */
  onPick?: (option: LookupOption) => void;
}

/**
 * A record picked by searching, such as a customer or an item, shown as its
 * number with its name. The form holds `{ number, name }` or null.
 */
export function LookupField<T extends FieldValues, O = T>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
  readOnly,
  className,
  hideLabel,
  search,
  placeholder,
  debounceMs = 250,
  onPick,
}: LookupFieldProps<T, O>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const parsed = lookupValueSchema.safeParse(field.value);
        const value = parsed.success ? parsed.data : null;
        return (
          <FieldFrame
            label={label}
            hint={hint}
            required={required}
            hideLabel={hideLabel}
            className={className}
          >
            {readOnly === true ? (
              <FormControl>
                <Input
                  ref={field.ref}
                  name={field.name}
                  readOnly
                  value={lookupText(value)}
                  className={FIELD_CONTROL}
                />
              </FormControl>
            ) : (
              <LookupControl
                value={value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                name={field.name}
                label={label}
                search={search}
                debounceMs={debounceMs}
                placeholder={placeholder}
                required={required}
                disabled={disabled}
                touched={fieldState.isTouched}
                onPick={onPick}
              />
            )}
          </FieldFrame>
        );
      }}
    />
  );
}
