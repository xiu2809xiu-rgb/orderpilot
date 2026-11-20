import type { SalesOrderDetail } from "@orderpilot/shared";
import { Clock } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Term, withTerms } from "@/components/common/Term";
import { formatDay } from "@/lib/format";
import { StatusChip } from "@/components/kit/StatusChip";
import { Amount } from "../orders/Amount";
import { ALL_DONE } from "../orders/orderRow";
import { EntryFact } from "./EntryFact";

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
 * The order in six facts: its stage, the team that holds it, its value (masked
 * for a role that may not see prices, with the reason), the ship date, the
 * order date and the customer's PO. Past due says so with a chip and the
 * tracker's own reason.
 */
export function OrderFacts({
  order,
  detail,
  stageLabel,
  heldAt,
  step,
  overdue,
}: {
  order: { externalDocumentNo: string };
  detail: SalesOrderDetail | undefined;
  stageLabel: string;
  heldAt: string;
  step: number | null;
  overdue: { overdue: boolean; daysOverdue: number; reason: string | null };
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
      <Fact label={t("columns.po")}>
        <span className="numeral">{order.externalDocumentNo}</span>
      </Fact>
      {detail ? <EntryFact detail={detail} /> : null}
      {overdue.overdue ? (
        <div className="od-fact od-fact-wide">
          <dt className="od-fact-label fs-12">{t("order.facts.pastDue")}</dt>
          <dd className="od-fact-value fs-14">
            <StatusChip kind="destructive" icon={Clock}>
              {t("cells.late", { count: overdue.daysOverdue })}
            </StatusChip>
            {overdue.reason ? (
              <span className="text-muted-foreground"> {overdue.reason}</span>
            ) : null}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
