import type { CheckResult } from "@orderpilot/shared";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "@/components/kit/StatusChip";
import { MaskedValue } from "@/components/parts/MaskedValue";
import { isPriceCheck } from "./priceChecks";

/**
 * One check. `priceMask` is the reason the order's amount is not shown in clear
 * to this role (masked, absent, or not answered yet), or null when it is; a
 * price check then shows the mask in place of every figure it carries.
 *
 * This is a cover on this page for a server-side gap, not the control: the
 * tracker sends every check's expected and actual values as plain text to every
 * role (issue #291, areas 3 and 4), so the JSON still carries the prices and
 * anyone reading the network tab sees them. The fix is for the server to mask
 * them; until then this page does not draw what its own header hides.
 */
export function CheckResultItem({
  check,
  priceMask,
  currentPoVersionNo,
}: {
  check: CheckResult;
  priceMask: string | null;
  /** The PO version the order is at now; above 1, a result with no number says so. */
  currentPoVersionNo: number | null;
}) {
  const { t } = useTranslation("order-tracker");
  const { t: to } = useTranslation("directions-orders");
  const pass = check.outcome === "pass";
  const hidden = priceMask !== null && isPriceCheck(check);
  const figure = (value: string) =>
    hidden ? (
      <MaskedValue masked reason={priceMask} />
    ) : (
      <span className="numeral">{value}</span>
    );
  return (
    <li className="od-check">
      <div className="od-check-head">
        <StatusChip
          kind={pass ? "success" : "destructive"}
          icon={pass ? CircleCheck : TriangleAlert}
        >
          {t(`detail.checks.${check.outcome}`)}
        </StatusChip>
        <h3 className="fs-14 font-medium text-foreground">{check.ruleLabel}</h3>
      </div>
      {typeof check.poVersionNo === "number" ? (
        <p className="fs-12 text-muted-foreground">
          {to("order.checks.ranOn", { n: check.poVersionNo })}
        </p>
      ) : currentPoVersionNo !== null && currentPoVersionNo > 1 ? (
        <p className="fs-12 text-muted-foreground">
          {to("order.checks.notRecorded")}
        </p>
      ) : null}
      <dl className="od-check-facts fs-14">
        <div>
          <dt className="text-muted-foreground">
            {t("detail.checks.expected")}
          </dt>
          <dd>{figure(check.expected)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("detail.checks.found")}</dt>
          <dd>{figure(check.actual)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">
            {t("detail.checks.tolerance")}
          </dt>
          <dd>
            {check.tolerance.label}: {figure(check.tolerance.value)}
          </dd>
        </div>
      </dl>
      {check.evidence.length > 0 ? (
        // Only the document and the place are listed, never the value read there.
        <p className="fs-14 text-muted-foreground">
          {t("detail.checks.evidence")}:{" "}
          {check.evidence
            .map(
              (e) =>
                `${e.documentType.replaceAll("_", " ").toLowerCase()}, ${e.location}`,
            )
            .join("; ")}
        </p>
      ) : null}
    </li>
  );
}
