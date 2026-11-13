import { useTranslation } from "react-i18next";
import { formatMoney } from "@/lib/format";
import { MaskedValue } from "../../parts/MaskedValue";

/** A value the server may have hidden: its mask code, or the amount when the role may see it. */
export interface MaskableAmount {
  masked: boolean;
  value: string | null;
  reason: "role" | "bankDetails" | "price" | "policy" | null;
}

/**
 * An amount in its currency, or a mask with the reason in the role's terms
 * ("prices are for roles that work with pricing"). The server decides what is
 * hidden; the figure is never in the page while it is.
 */
export function Amount({
  field,
  currency,
}: {
  field: MaskableAmount;
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <MaskedValue
      masked={field.masked}
      value={field.value === null ? null : formatMoney(field.value, currency)}
      reason={field.reason ? t(`mask.${field.reason}`) : null}
    />
  );
}
