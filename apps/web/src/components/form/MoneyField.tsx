import type { FieldValues } from "react-hook-form";
import { DecimalField, type DecimalFieldProps } from "./DecimalField";

interface MoneyFieldProps<T extends FieldValues, O> extends DecimalFieldProps<
  T,
  O
> {
  /** The ISO code shown beside the amount. Prices in this product are USD. */
  currency: string;
}

/**
 * An amount as a decimal string with its currency beside it, two places by
 * default: "1,200.5" is tidied to "1200.50" when the person leaves the field.
 */
export function MoneyField<T extends FieldValues, O = T>({
  currency,
  scale = 2,
  ...props
}: MoneyFieldProps<T, O>) {
  return <DecimalField {...props} scale={scale} prefix={currency} />;
}
