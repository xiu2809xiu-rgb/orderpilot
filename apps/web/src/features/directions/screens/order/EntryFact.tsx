import type { SalesOrderDetail } from "@orderpilot/shared";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/kit/Badge";
import { EntryChip } from "../orders/EntryChip";

/**
 * Where the order came from and how far its entry has got, in one line under
 * the facts: a chip (Draft, Submitted, Void, or Sample for an order Spectra
 * gave us) and, beside it, why a person cannot change it here. Only a draft
 * entered here can be changed, and only by a role that may edit orders, and
 * that role is sent to the order form instead of this page.
 */
export function EntryFact({ detail }: { detail: SalesOrderDetail }) {
  const { t } = useTranslation("directions-orders");
  const state = detail.captureState;
  return (
    <div className="od-fact od-fact-wide" data-fact="entry">
      <dt className="od-fact-label fs-12">{t("order.entry.label")}</dt>
      <dd className="od-fact-value fs-14 od-entry">
        {state ? (
          <EntryChip state={state} />
        ) : (
          <Badge variant="outline" radius="full">
            {t("source.sample")}
          </Badge>
        )}
        <span className="text-muted-foreground">
          {t(`order.entry.${state ?? "sample"}`)}
        </span>
      </dd>
    </div>
  );
}
