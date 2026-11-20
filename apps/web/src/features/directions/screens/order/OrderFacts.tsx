import type { SalesOrderDetail } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Term, withTerms } from "@/components/common/Term";
import { formatDay } from "@/lib/format";
import { Amount } from "../orders/Amount";
import { ALL_DONE } from "../orders/orderRow";

function Fact({
  label,
  children,
  main = false,
}: {
  label: ReactNode;
  children: ReactNode;
  /** The figure the eye should land on: set larger. */
  main?: boolean;
}) {
  return (
    <div className="od-fact" data-main={main || undefined}>
      <dt className="od-fact-label fs-12">{label}</dt>
      <dd className="od-fact-value fs-14">{children}</dd>
    </div>
  );
}

/**
 * The order in six facts, in one row: its stage, the team that holds it, its
 * value (masked for a role that may not see prices, with the reason), the ship
 * date, the order date and the customer's PO. How late it is, if it is, is the
 * status block's to say, once.
 */
export function OrderFacts({
  order,
  detail,
  stageLabel,
  heldAt,
  step,
}: {
  order: { externalDocumentNo: string };
  detail: SalesOrderDetail | undefined;
  stageLabel: string;
  heldAt: string;
  step: number | null;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <dl className="od-facts-bar dx-card">
      <Fact label={t("order.facts.stage")}>{withTerms(stageLabel)}</Fact>
      <Fact label={<Term word="heldAt">{t("columns.heldAt")}</Term>}>
        {step === ALL_DONE ? t("cells.done") : heldAt}
      </Fact>
      <Fact label={t("columns.value")} main>
        {detail ? (
          <Amount field={detail.amount} currency={detail.currencyCode} />
        ) : (
          <span aria-hidden="true">-</span>
        )}
        {/* Most customers pay before the goods ship, so the share asked up front
            belongs beside the value. It is a percentage, not a price. */}
        {detail?.amount.masked && detail.amount.reason ? (
          // The mask's own reason shows on hover, which a tablet has none of.
          <span className="od-fact-note fs-12 text-muted-foreground">
            {t("order.facts.hidden", {
              reason: t(`mask.${detail.amount.reason}`),
            })}
          </span>
        ) : null}
        {detail ? (
          <span className="od-fact-note fs-12 text-muted-foreground">
            {t("order.facts.prepayment", {
              percent: Number(detail.prepaymentPercent),
            })}
          </span>
        ) : null}
      </Fact>
      <Fact label={t("columns.shipDate")}>
        {detail?.shipmentDate
          ? formatDay(detail.shipmentDate)
          : t("cells.notSet")}
      </Fact>
      <Fact label={t("columns.orderDate")}>
        {detail ? formatDay(detail.orderDate) : t("cells.notSet")}
      </Fact>
      <Fact label={withTerms(t("columns.po"))}>
        <span className="numeral">{order.externalDocumentNo}</span>
      </Fact>
    </dl>
  );
}
