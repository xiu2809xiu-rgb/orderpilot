import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface MoneyProps {
  /** A decimal string such as "12340.5". Never a float. */
  value: string;
  currency?: string;
  className?: string;
}

/**
 * An amount with its currency, "USD 12,340.00", in tabular figures so that a
 * column lines up. Put it in a column with `kind: "money"` to right-align it.
 */
export function Money({ value, currency = "USD", className }: MoneyProps) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      {formatMoney(value, currency)}
    </span>
  );
}
