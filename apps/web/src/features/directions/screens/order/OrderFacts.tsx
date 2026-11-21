import type { SalesOrderDetail } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatDay } from "@/lib/format";
import { Amount } from "../orders/Amount";

function Fact({
  label,
  children,
  main = false,
  labelClassName = "od-fact-label fs-12",
}: {
  label: ReactNode;
  children: ReactNode;
  /** The figure the eye should land on: set larger. */
  main?: boolean;
  /** The Value label is styled as the status card's "Current Stage" is. */
  labelClassName?: string;
}) {
  return (
    <div className="od-fact" data-main={main || undefined}>
      <dt className={labelClassName}>{label}</dt>
      <dd className="od-fact-value fs-14">{children}</dd>
    </div>
  );
}

/**
 * The order in four facts, two rows of two: its value (masked for a role
 * that may not see prices, with the reason), the customer's PO, the order
 * date and the ship date. The stage and the team that holds it are the
 * status card's to say, just above; how late it is, if it is, is that
 * card's to say too, once.
 */
export function OrderFacts({
  order,
  detail,
}: {
  order: { externalDocumentNo: string };
  detail: SalesOrderDetail | undefined;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <dl className="od-facts-bar dx-card">
      <Fact label={t("columns.value")} main labelClassName="dx-section-title">
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
      <Fact label={t("columns.po")}>
        <span className="numeral">{order.externalDocumentNo}</span>
      </Fact>
      <Fact label={t("columns.orderDate")}>
        {detail ? formatDay(detail.orderDate) : t("cells.notSet")}
      </Fact>
      <Fact label={t("columns.shipDate")}>
        {detail?.shipmentDate
          ? formatDay(detail.shipmentDate)
          : t("cells.notSet")}
      </Fact>
    </dl>
  );
}
