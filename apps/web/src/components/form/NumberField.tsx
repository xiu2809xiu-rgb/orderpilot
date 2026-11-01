import type { FieldValues } from "react-hook-form";
import { DecimalField, type DecimalFieldProps } from "./DecimalField";

interface NumberFieldProps<T extends FieldValues, O> extends DecimalFieldProps<
  T,
  O
> {
  /** The unit after the number, such as "pcs" or "kg". */
  unit?: string;
}

/**
 * A quantity or a count. Its value is a string, so an empty field stays empty
 * instead of becoming 0, and the schema turns it into a number.
 */
export function NumberField<T extends FieldValues, O = T>({
  unit,
  ...props
}: NumberFieldProps<T, O>) {
  return <DecimalField {...props} suffix={unit} />;
}
