import type { PriceDifference } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { MaskedValue } from "@/components/parts/MaskedValue";
import { formatMoney } from "@/lib/format";
import { changeText } from "./differenceText";

/** A unit price or a total: a mask with the role's reason, or the figure and its change. */
export function PriceCell({
  price,
  currency,
}: {
  price: PriceDifference;
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  if (price.masked) {
    return <MaskedValue masked reason={t(`mask.${price.reason}`)} />;
  }
  return (
    <span className="numeral">
      {changeText(t, price, (value) => formatMoney(value, currency))}
    </span>
  );
}
