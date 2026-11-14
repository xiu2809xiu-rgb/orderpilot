import { useRef } from "react";
import type {
  ControllerRenderProps,
  FieldPath,
  FieldValues,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { asText, FIELD_CONTROL } from "./fieldTypes";

export interface SelectOption {
  /** What the form holds. Never an empty string: that means "none chosen". */
  value: string;
  label: string;
}

interface SelectControlProps<T extends FieldValues> {
  field: ControllerRenderProps<T, FieldPath<T>>;
  options: readonly SelectOption[];
  placeholder: string | undefined;
  required: boolean | undefined;
  disabled: boolean | undefined;
  readOnly: boolean | undefined;
}

/** The control of a select: a read-only box, or the list that opens on click. */
export function SelectControl<T extends FieldValues>({
  field,
  options,
  placeholder,
  required,
  disabled,
  readOnly,
}: SelectControlProps<T>) {
  const { t } = useTranslation("form");
  // Opening the list moves focus into it. That blur is not the person leaving
  // the field, so it must not mark it touched and show "required" mid-choice.
  const open = useRef(false);
  const value = asText(field.value);

  if (readOnly === true) {
    const chosen = options.find((option) => option.value === value);
    return (
      <FormControl>
        <Input
          ref={field.ref}
          name={field.name}
          readOnly
          value={chosen?.label ?? ""}
          className={FIELD_CONTROL}
        />
      </FormControl>
    );
  }
  return (
    <Select
      value={value}
      onValueChange={field.onChange}
      disabled={disabled}
      onOpenChange={(next) => {
        open.current = next;
      }}
    >
      <FormControl>
        <SelectTrigger
          ref={field.ref}
          name={field.name}
          className="pointer-coarse:data-[size=default]:h-11"
          aria-required={required === true ? true : undefined}
          onBlur={() => {
            if (!open.current) field.onBlur();
          }}
        >
          <SelectValue placeholder={placeholder ?? t("select.placeholder")} />
        </SelectTrigger>
      </FormControl>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
