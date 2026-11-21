import type { OrderCaptureState } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";

/**
 * What became of an order entered here, in words that stay on the page. A
 * reader who finds no form has to see why without opening the badge: a draft
 * is for the roles that may edit orders, and a voided order is closed. A
 * sample's meaning stays behind its badge, because every sample says the same.
 */
export function EntryMeaning({ state }: { state: OrderCaptureState }) {
  const { t } = useTranslation("directions-orders");
  return <p className="od-entry-meaning fs-14">{t(`order.entry.${state}`)}</p>;
}
