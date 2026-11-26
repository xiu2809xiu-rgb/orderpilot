import type { PoVersionSummary } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { VersionRow } from "./VersionRow";

/** Every PO version of the order, newest first, each one able to open its lines. */
export function VersionList({
  orderNo,
  versions,
  currency,
}: {
  orderNo: string;
  versions: readonly PoVersionSummary[];
  currency: string;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <ul aria-label={t("order.versions.listLabel")}>
      {versions.map((version) => (
        <VersionRow
          key={version.poVersionNo}
          orderNo={orderNo}
          version={version}
          currency={currency}
        />
      ))}
    </ul>
  );
}
