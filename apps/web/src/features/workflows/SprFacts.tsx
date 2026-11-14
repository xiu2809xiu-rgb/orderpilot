import type { SprDetail } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/common";
import { formatAmount, formatQuantity } from "./format";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd data-numeric className="break-words font-medium">
        {children}
      </dd>
    </div>
  );
}

/** Money as the rest of the app writes it: the currency, then the amount. */
function money(amount: string, currency: string): string {
  return `${currency} ${formatAmount(amount)}`;
}

/** The request itself: vendor, item, quantity and amount. */
export function SprSummary({ spr }: { spr: SprDetail }) {
  const { t } = useTranslation("workflows");
  return (
    <dl className="grid gap-s2 sm:grid-cols-2">
      <Fact label={t("spr.vendor")}>
        {spr.vendor.name} ({spr.vendor.no})
      </Fact>
      <Fact label={t("spr.item")}>
        {spr.item.description} ({spr.item.no})
      </Fact>
      <Fact label={t("spr.quantity")}>{formatQuantity(spr.quantity)}</Fact>
      <Fact label={t("spr.unitCost")}>
        {money(spr.unitCost, spr.currencyCode)}
      </Fact>
      <Fact label={t("spr.amount")}>{money(spr.amount, spr.currencyCode)}</Fact>
    </dl>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-s1">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <dl className="grid gap-s2 sm:grid-cols-3">{children}</dl>
    </section>
  );
}

/**
 * Why there is an SPR: first the stock and sales Spectra raises one from, then
 * the order whose shortfall sets the suggested quantity.
 */
export function SprBasis({ basis }: { basis: SprDetail["basis"] }) {
  const { t } = useTranslation("workflows");
  return (
    <div className="space-y-s3">
      <Group title={t("spr.stockAndSales")}>
        <Fact label={t("spr.inventory")}>
          {formatQuantity(basis.inventory)}
        </Fact>
        <Fact label={t("spr.runRate3m")}>
          {formatQuantity(basis.runRate3m)}
        </Fact>
        <Fact label={t("spr.monthsOfCover")}>
          {basis.monthsOfCover === null ? (
            t("spr.noSales")
          ) : (
            <span className="inline-flex flex-wrap items-center gap-2">
              {formatAmount(basis.monthsOfCover)}
              {/* Under a month of stock is what makes an SPR urgent. */}
              {Number(basis.monthsOfCover) < 1 ? (
                <StatusBadge tone="warning">{t("spr.lowCover")}</StatusBadge>
              ) : null}
            </span>
          )}
        </Fact>
      </Group>
      <Group title={t("spr.thisOrder")}>
        <Fact label={t("spr.ordered")}>{formatQuantity(basis.ordered)}</Fact>
        <Fact label={t("spr.qtyOnSalesOrder")}>
          {formatQuantity(basis.qtyOnSalesOrder)}
        </Fact>
        <Fact label={t("spr.qtyOnPurchOrder")}>
          {formatQuantity(basis.qtyOnPurchOrder)}
        </Fact>
        <Fact label={t("spr.availableStock")}>
          {formatQuantity(basis.availableStock)}
        </Fact>
        <Fact label={t("spr.shortfall")}>
          {formatQuantity(basis.shortfall)}
        </Fact>
      </Group>
    </div>
  );
}

/**
 * Who decides, as Spectra described it, then the approver on file and any
 * limit or stand-in their setup still holds. A row the setup does not hold is
 * left out rather than shown as "None".
 */
export function ApproverFacts({ spr }: { spr: SprDetail }) {
  const { t } = useTranslation("workflows");
  const { setup } = spr.approver;
  const limit = (amount: string | null, unlimited: boolean) =>
    unlimited
      ? t("spr.unlimited")
      : amount
        ? `${t("spr.limited")}: ${money(amount, spr.currencyCode)}`
        : t("spr.noLimit");
  const noLimits =
    setup.unlimitedSalesApproval && setup.unlimitedPurchaseApproval;
  return (
    <dl className="grid gap-s2 sm:grid-cols-2">
      <Fact label={t("spr.decidedBy")}>{t("spr.anyOfThree")}</Fact>
      <Fact label={t("spr.approverOnFile")}>{spr.approver.displayName}</Fact>
      {noLimits ? (
        <Fact label={t("spr.limits")}>{t("spr.noLimits")}</Fact>
      ) : (
        <>
          <Fact label={t("spr.salesLimit")}>
            {limit(
              setup.salesAmountApprovalLimit,
              setup.unlimitedSalesApproval,
            )}
          </Fact>
          <Fact label={t("spr.purchaseLimit")}>
            {limit(
              setup.purchaseAmountApprovalLimit,
              setup.unlimitedPurchaseApproval,
            )}
          </Fact>
        </>
      )}
      {spr.escalatesToName ? (
        <Fact label={t("spr.approverId")}>{spr.escalatesToName}</Fact>
      ) : null}
      {spr.substituteName ? (
        <Fact label={t("spr.substitute")}>{spr.substituteName}</Fact>
      ) : null}
    </dl>
  );
}
