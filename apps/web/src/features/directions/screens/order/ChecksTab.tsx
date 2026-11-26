import type { CheckResult, MasterMatch } from "@orderpilot/shared";
import { CircleCheck, ShieldCheck, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "@/components/kit/StatusChip";
import { EmptyState } from "@/components/parts/EmptyState";
import { MaskedValue } from "@/components/parts/MaskedValue";
import { ChecksMatches } from "./ChecksMatches";
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
function Result({
  check,
  priceMask,
}: {
  check: CheckResult;
  priceMask: string | null;
}) {
  const { t } = useTranslation("order-tracker");
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

/**
 * What the rules found on this order: each check with what was expected, what
 * was found, the tolerance and the evidence, then the customer and items as
 * printed on the documents beside the Business Central record with the same
 * number. Names are shown and never matched on: a look-alike is a possible
 * match for a person to look at. Both come from the tracker, as the old order
 * page showed them. For a role whose prices are masked, a price check shows the
 * mask in place of its figures (see `Result`).
 */
export function ChecksTab({
  checks,
  matches,
  priceMask,
  typedHere,
}: {
  checks: readonly CheckResult[];
  matches: readonly MasterMatch[];
  /** Why the order's amount is masked for this role, or null when it may see prices. */
  priceMask: string | null;
  /** The order was typed in here: no document of it is read, so no check runs. */
  typedHere: boolean;
}) {
  const { t } = useTranslation("directions-orders");
  return (
    <div className="od-checks">
      {checks.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t(
            `order.checks.${typedHere ? "typedHereTitle" : "emptyTitle"}`,
          )}
          description={t(
            `order.checks.${typedHere ? "typedHereBody" : "emptyBody"}`,
          )}
        />
      ) : (
        <ul className="od-check-list">
          {checks.map((check) => (
            <Result key={check.id} check={check} priceMask={priceMask} />
          ))}
        </ul>
      )}
      {matches.length > 0 ? (
        <section aria-labelledby="od-matches" className="od-matches">
          <h3 id="od-matches" className="fs-14 font-semibold">
            {t("order.checks.matches")}
          </h3>
          <ChecksMatches matches={matches} />
        </section>
      ) : null}
    </div>
  );
}
