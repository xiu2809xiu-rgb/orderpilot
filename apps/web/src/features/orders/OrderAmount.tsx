import type { MaskedField } from "@orderpilot/shared";
import { MaskedValue, Money } from "@/components/common";

/** An order's total as the server sent it: the figure, or dots with the reason it is hidden. */
export function OrderAmount({
  field,
  currency,
}: {
  field: MaskedField;
  currency: string;
}) {
  if (field.masked || field.value === null) {
    return <MaskedValue masked reason={field.reason ?? "role"} />;
  }
  return <Money value={field.value} currency={currency} />;
}
