import type { CheckResult, MasterMatch } from "@orderpilot/shared";
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/parts/EmptyState";
import { CheckResultItem } from "./CheckResultItem";
import { ChecksMatches } from "./ChecksMatches";

/**
 * What the rules found on this order: each check with what was expected, what
 * was found, the tolerance and the evidence, then the customer and items as
 * printed on the documents beside the Business Central record with the same
 * number. Names are shown and never matched on: a look-alike is a possible
 * match for a person to look at. Both come from the tracker, as the old order
 * page showed them. For a role whose prices are masked, a price check shows the
 * mask in place of its figures (see `CheckResultItem`).
 */
export function ChecksTab({
  checks,
  matches,
  priceMask,
  typedHere,
  currentPoVersionNo,
}: {
  checks: readonly CheckResult[];
  matches: readonly MasterMatch[];
  /** Why the order's amount is masked for this role, or null when it may see prices. */
  priceMask: string | null;
  /** The order was typed in here: no document of it is read, so no check runs. */
  typedHere: boolean;
  /** The PO version the order is at now, or null when it has none (a sample, a draft). */
  currentPoVersionNo: number | null;
}) {
  const { t } = useTranslation("directions-orders");
  // No check has run on any PO version of an order typed in here, so the empty
  // state says that and not only the order, once it has more than one.
  const versioned = currentPoVersionNo !== null && currentPoVersionNo > 1;
  return (
    <div className="od-checks">
      {checks.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t(
            `order.checks.${typedHere ? "typedHereTitle" : "emptyTitle"}`,
          )}
          description={t(
            `order.checks.${
              typedHere
                ? versioned
                  ? "typedHereVersionsBody"
                  : "typedHereBody"
                : "emptyBody"
            }`,
          )}
        />
      ) : (
        <ul className="od-check-list">
          {checks.map((check) => (
            <CheckResultItem
              key={check.id}
              check={check}
              priceMask={priceMask}
              currentPoVersionNo={currentPoVersionNo}
            />
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
