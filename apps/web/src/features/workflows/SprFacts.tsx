import type { SprDetail } from "@orderpilot/shared";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatAmount } from "./format";

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
      <Fact label={t("spr.quantity")}>{formatAmount(spr.quantity)}</Fact>
      <Fact label={t("spr.unitCost")}>
        {formatAmount(spr.unitCost)} {spr.currencyCode}
      </Fact>
      <Fact label={t("spr.amount")}>
        {formatAmount(spr.amount)} {spr.currencyCode}
      </Fact>
    </dl>
  );
}

/** The stock figures the suggestion was worked out from. */
export function SprBasis({ basis }: { basis: SprDetail["basis"] }) {
  const { t } = useTranslation("workflows");
  return (
    <dl className="grid gap-s2 sm:grid-cols-3">
      <Fact label={t("spr.ordered")}>{formatAmount(basis.ordered)}</Fact>
      <Fact label={t("spr.inventory")}>{formatAmount(basis.inventory)}</Fact>
      <Fact label={t("spr.qtyOnSalesOrder")}>
        {formatAmount(basis.qtyOnSalesOrder)}
      </Fact>
      <Fact label={t("spr.qtyOnPurchOrder")}>
        {formatAmount(basis.qtyOnPurchOrder)}
      </Fact>
      <Fact label={t("spr.availableStock")}>
        {formatAmount(basis.availableStock)}
      </Fact>
      <Fact label={t("spr.shortfall")}>{formatAmount(basis.shortfall)}</Fact>
    </dl>
  );
}

/** The approver in the shape of Navision's Approval User Setup. */
export function ApproverFacts({ spr }: { spr: SprDetail }) {
  const { t } = useTranslation("workflows");
  const { setup } = spr.approver;
  const limit = (amount: string | null, unlimited: boolean) =>
    unlimited
      ? t("spr.unlimited")
      : amount
        ? `${t("spr.limited")}: ${formatAmount(amount)} ${spr.currencyCode}`
        : t("spr.noLimit");
  return (
    <dl className="grid gap-s2 sm:grid-cols-2">
      <Fact label={t("spr.approverName")}>{spr.approver.displayName}</Fact>
      <Fact label={t("spr.approverId")}>
        {setup.approverId ?? t("spr.noSubstitute")}
      </Fact>
      <Fact label={t("spr.salesLimit")}>
        {limit(setup.salesAmountApprovalLimit, setup.unlimitedSalesApproval)}
      </Fact>
      <Fact label={t("spr.purchaseLimit")}>
        {limit(
          setup.purchaseAmountApprovalLimit,
          setup.unlimitedPurchaseApproval,
        )}
      </Fact>
      <Fact label={t("spr.substitute")}>
        {spr.substituteName ?? t("spr.noSubstitute")}
      </Fact>
    </dl>
  );
}
