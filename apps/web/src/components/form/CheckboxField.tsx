import type { FieldValues } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { FieldBaseProps } from "./fieldTypes";

/**
 * A yes or no, with its label beside the box. Read-only keeps it focusable and
 * says so to a screen reader, where disabled would hide it from the Tab order.
 */
export function CheckboxField<T extends FieldValues, O = T>({
  control,
  name,
  label,
  hint,
  required,
  disabled,
  readOnly = false,
  hideLabel = false,
  className,
}: FieldBaseProps<T, O>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          hasDescription={hint !== undefined}
          className={cn("content-center", className)}
        >
          <div className="flex min-h-8 items-center gap-2 pointer-coarse:min-h-11">
            <FormControl>
              <Checkbox
                ref={field.ref}
                name={field.name}
                checked={field.value === true}
                onCheckedChange={(checked) => {
                  if (!readOnly) field.onChange(checked === true);
                }}
                onBlur={field.onBlur}
                disabled={disabled}
                aria-readonly={readOnly ? true : undefined}
                aria-required={required === true ? true : undefined}
                // The box is 16 px; this reaches 44 px on a touch screen.
                className="relative pointer-coarse:size-6 after:absolute after:-inset-2.5 after:content-['']"
              />
            </FormControl>
            <FormLabel
              required={required}
              className={cn(
                "text-sm text-foreground pointer-coarse:min-h-11",
                hideLabel && "sr-only",
              )}
            >
              {label}
            </FormLabel>
          </div>
          {hint === undefined ? null : (
            <FormDescription>{hint}</FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
