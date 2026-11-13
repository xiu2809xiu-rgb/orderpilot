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
 * An amount with its currency, or a mask with the reason in the role's terms
 * ("prices are for roles that work with pricing"). The currency is a small
 * muted prefix, so the figure itself can be set large (Paper) without the
 * code beside it taking the room; they still read as one money value. The
 * server decides what is hidden; the figure is never in the page while it is.
 */
export function Amount({
  field,
  currency,
}: {
  field: MaskableAmount;
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  if (field.masked || field.value === null) {
    return (
      <MaskedValue
        masked
        reason={field.reason ? t(`mask.${field.reason}`) : null}
      />
    );
  }
  // formatMoney gives "USD 8,600.36": the code, a space, the figure.
  const [, figure = ""] = formatMoney(field.value, currency).split(" ");
  return (
    <span className="numeral">
      <span className="od-cur">{currency}</span> {figure}
    </span>
  );
}
